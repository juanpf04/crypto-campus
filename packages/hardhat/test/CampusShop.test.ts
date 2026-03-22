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
});
