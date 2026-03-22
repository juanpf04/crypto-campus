import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

describe("CampusShop", async function () {
    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();

    async function increaseTime(seconds: number) {
        await publicClient.transport.request({ method: "evm_increaseTime" as never, params: [seconds] as never });
        await publicClient.transport.request({ method: "evm_mine" as never, params: [] as never });
    }

    async function deploySystem() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const shopToken = await viem.deployContract("ShopToken", [campusRoles.address]);
        const campusShop = await viem.deployContract("CampusShop", [
            campusRoles.address,
            shopToken.address,
            "https://shop.ucm.es/",
        ]);

        const [, student1, student2, outsider] = await viem.getWalletClients();
        const studentRole = await campusRoles.read.STUDENT_ROLE();

        await campusRoles.write.registerUser([student1.account.address, "Student1", studentRole]);
        await campusRoles.write.registerUser([student2.account.address, "Student2", studentRole]);

        await shopToken.write.setTrustedSpender([campusShop.address]);
        await shopToken.write.mint([student1.account.address, 200n]);
        await shopToken.write.mint([student2.account.address, 150n]);

        return { campusRoles, shopToken, campusShop, student1, student2, outsider };
    }

    describe("Deployment", function () {
        it("Should set references and counters", async function () {
            const { campusShop, campusRoles, shopToken } = await deploySystem();
            assert.equal(getAddress(await campusShop.read.campusRoles()), getAddress(campusRoles.address));
            assert.equal(getAddress(await campusShop.read.shopToken()), getAddress(shopToken.address));
            assert.equal(await campusShop.read.nextProductId(), 1n);
            assert.equal(await campusShop.read.nextOrderId(), 1n);
        });
    });

    describe("Product management", function () {
        it("Should add, update, deactivate and reactivate products", async function () {
            const { campusShop } = await deploySystem();

            await campusShop.write.addProduct([50n, 20n]);
            let [price, stock, active, exists] = await campusShop.read.getProduct([1n]);
            assert.equal(price, 50n);
            assert.equal(stock, 20n);
            assert.equal(active, true);
            assert.equal(exists, true);

            await campusShop.write.updateProduct([1n, 40n, 30n]);
            [price, stock] = await campusShop.read.getProduct([1n]);
            assert.equal(price, 40n);
            assert.equal(stock, 30n);

            await campusShop.write.deactivateProduct([1n]);
            [, , active] = await campusShop.read.getProduct([1n]);
            assert.equal(active, false);

            await campusShop.write.reactivateProduct([1n]);
            [, , active] = await campusShop.read.getProduct([1n]);
            assert.equal(active, true);
        });

        it("Should revert addProduct with zero price", async function () {
            const { campusShop } = await deploySystem();
            await assert.rejects(async () => {
                await campusShop.write.addProduct([0n, 1n]);
            });
        });
    });

    describe("Purchase and returns", function () {
        it("Should execute purchase and admin processReturn", async function () {
            const { campusShop, shopToken, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });

            assert.equal(await shopToken.read.balanceOf([student1.account.address]), 150n);
            assert.equal(await shopToken.read.balanceOf([campusShop.address]), 50n);
            assert.equal(await campusShop.read.balanceOf([student1.account.address, 1n]), 1n);

            await campusShop.write.processReturn([1n]);
            assert.equal(await shopToken.read.balanceOf([student1.account.address]), 200n);
            assert.equal(await campusShop.read.balanceOf([student1.account.address, 1n]), 0n);
        });

        it("Should allow requestReturn within window and reject after window", async function () {
            const { campusShop, student1 } = await deploySystem();

            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });
            await campusShop.write.markDelivered([1n]);

            await campusShop.write.requestReturn([1n], { account: student1.account });
            const order1 = await campusShop.read.getOrder([1n]);
            assert.equal(order1.status, 3);

            await campusShop.write.purchase([1n], { account: student1.account });
            await campusShop.write.markDelivered([2n]);
            await increaseTime(31 * 24 * 60 * 60);

            await assert.rejects(async () => {
                await campusShop.write.requestReturn([2n], { account: student1.account });
            });
        });

        it("Should enforce student/admin restrictions", async function () {
            const { campusShop, outsider } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);

            await assert.rejects(async () => {
                await campusShop.write.purchase([1n], { account: outsider.account });
            });

            await assert.rejects(async () => {
                await campusShop.write.addProduct([10n, 1n], { account: outsider.account });
            });
        });
    });

    describe("updateProduct revert paths", function () {
        it("Should revert on non-existent product", async function () {
            const { campusShop } = await deploySystem();
            await assert.rejects(async () => {
                await campusShop.write.updateProduct([999n, 10n, 5n]);
            });
        });

        it("Should revert on zero price", async function () {
            const { campusShop } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await assert.rejects(async () => {
                await campusShop.write.updateProduct([1n, 0n, 10n]);
            });
        });

        it("Should revert for non-admin", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await assert.rejects(async () => {
                await campusShop.write.updateProduct([1n, 40n, 10n], { account: student1.account });
            });
        });
    });

    describe("deactivateProduct revert paths", function () {
        it("Should revert on non-existent product", async function () {
            const { campusShop } = await deploySystem();
            await assert.rejects(async () => {
                await campusShop.write.deactivateProduct([999n]);
            });
        });

        it("Should revert when already inactive", async function () {
            const { campusShop } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.deactivateProduct([1n]);
            await assert.rejects(async () => {
                await campusShop.write.deactivateProduct([1n]);
            });
        });

        it("Should revert for non-admin", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await assert.rejects(async () => {
                await campusShop.write.deactivateProduct([1n], { account: student1.account });
            });
        });
    });

    describe("reactivateProduct revert paths", function () {
        it("Should revert on non-existent product", async function () {
            const { campusShop } = await deploySystem();
            await assert.rejects(async () => {
                await campusShop.write.reactivateProduct([999n]);
            });
        });

        it("Should revert when already active", async function () {
            const { campusShop } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await assert.rejects(async () => {
                await campusShop.write.reactivateProduct([1n]);
            });
        });

        it("Should revert for non-admin", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.deactivateProduct([1n]);
            await assert.rejects(async () => {
                await campusShop.write.reactivateProduct([1n], { account: student1.account });
            });
        });
    });

    describe("markDelivered revert paths", function () {
        it("Should revert on non-existent order", async function () {
            const { campusShop } = await deploySystem();
            await assert.rejects(async () => {
                await campusShop.write.markDelivered([999n]);
            });
        });

        it("Should revert on already delivered order", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });
            await campusShop.write.markDelivered([1n]);
            await assert.rejects(async () => {
                await campusShop.write.markDelivered([1n]);
            });
        });

        it("Should revert for non-admin", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });
            await assert.rejects(async () => {
                await campusShop.write.markDelivered([1n], { account: student1.account });
            });
        });
    });

    describe("processReturn revert paths", function () {
        it("Should revert on non-existent order", async function () {
            const { campusShop } = await deploySystem();
            await assert.rejects(async () => {
                await campusShop.write.processReturn([999n]);
            });
        });

        it("Should revert on already returned order", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });
            await campusShop.write.processReturn([1n]);
            await assert.rejects(async () => {
                await campusShop.write.processReturn([1n]);
            });
        });

        it("Should revert for non-admin", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });
            await assert.rejects(async () => {
                await campusShop.write.processReturn([1n], { account: student1.account });
            });
        });
    });

    describe("Purchase failure scenarios", function () {
        it("Should revert purchase on inactive product", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.deactivateProduct([1n]);
            await assert.rejects(async () => {
                await campusShop.write.purchase([1n], { account: student1.account });
            });
        });

        it("Should revert purchase on out-of-stock product", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 0n]);
            await assert.rejects(async () => {
                await campusShop.write.purchase([1n], { account: student1.account });
            });
        });

        it("Should revert purchase with insufficient ShopTokens", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([300n, 10n]);
            await assert.rejects(async () => {
                await campusShop.write.purchase([1n], { account: student1.account });
            });
        });
    });

    describe("requestReturn revert paths", function () {
        it("Should revert on non-existent order", async function () {
            const { campusShop, student1 } = await deploySystem();
            await assert.rejects(async () => {
                await campusShop.write.requestReturn([999n], { account: student1.account });
            });
        });

        it("Should revert on order in Paid status (not Delivered)", async function () {
            const { campusShop, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });
            await assert.rejects(async () => {
                await campusShop.write.requestReturn([1n], { account: student1.account });
            });
        });

        it("Should revert for non-owner student", async function () {
            const { campusShop, student1, student2 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });
            await campusShop.write.markDelivered([1n]);
            await assert.rejects(async () => {
                await campusShop.write.requestReturn([1n], { account: student2.account });
            });
        });
    });

    describe("View functions", function () {
        it("Should return correct student orders array after purchases", async function () {
            const { campusShop, student1, student2 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.addProduct([30n, 10n]);

            await campusShop.write.purchase([1n], { account: student1.account });
            await campusShop.write.purchase([2n], { account: student1.account });
            await campusShop.write.purchase([1n], { account: student2.account });

            const student1Orders = await campusShop.read.getStudentOrders([student1.account.address]);
            assert.equal(student1Orders.length, 2);
            assert.equal(student1Orders[0], 1n);
            assert.equal(student1Orders[1], 2n);

            const student2Orders = await campusShop.read.getStudentOrders([student2.account.address]);
            assert.equal(student2Orders.length, 1);
            assert.equal(student2Orders[0], 3n);
        });

        it("Should return correct return receipt token ID", async function () {
            const { campusShop } = await deploySystem();
            const returnReceiptOffset = await campusShop.read.RETURN_RECEIPT_OFFSET();

            const tokenId1 = await campusShop.read.getReturnReceiptTokenId([1n]);
            assert.equal(tokenId1, returnReceiptOffset + 1n);

            const tokenId5 = await campusShop.read.getReturnReceiptTokenId([5n]);
            assert.equal(tokenId5, returnReceiptOffset + 5n);
        });
    });

    describe("processReturn on Delivered order", function () {
        it("Should process return on a delivered order", async function () {
            const { campusShop, shopToken, student1 } = await deploySystem();
            await campusShop.write.addProduct([50n, 20n]);
            await campusShop.write.purchase([1n], { account: student1.account });

            assert.equal(await shopToken.read.balanceOf([student1.account.address]), 150n);

            await campusShop.write.markDelivered([1n]);
            const orderAfterDelivery = await campusShop.read.getOrder([1n]);
            assert.equal(orderAfterDelivery.status, 2);

            await campusShop.write.processReturn([1n]);
            const orderAfterReturn = await campusShop.read.getOrder([1n]);
            assert.equal(orderAfterReturn.status, 3);

            assert.equal(await shopToken.read.balanceOf([student1.account.address]), 200n);
            assert.equal(await campusShop.read.balanceOf([student1.account.address, 1n]), 0n);

            const returnReceiptOffset = await campusShop.read.RETURN_RECEIPT_OFFSET();
            assert.equal(await campusShop.read.balanceOf([student1.account.address, returnReceiptOffset + 1n]), 1n);

            const [, stock] = await campusShop.read.getProduct([1n]);
            assert.equal(stock, 20n);
        });
    });
});
