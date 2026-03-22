import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, zeroAddress } from "viem";

describe("LibraryToken", async function () {
    const { viem } = await network.connect();

    async function deploy() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const token = await viem.deployContract("LibraryToken", [campusRoles.address]);
        const [, student1, student2, outsider] = await viem.getWalletClients();
        return { campusRoles, token, student1, student2, outsider };
    }

    describe("Deployment", function () {
        it("Should have expected metadata", async function () {
            const { token } = await deploy();
            assert.equal(await token.read.name(), "LibraryToken");
            assert.equal(await token.read.symbol(), "LIBT");
            assert.equal(await token.read.decimals(), 0);
            assert.equal(await token.read.totalSupply(), 0n);
            assert.equal(await token.read.INITIAL_TOKENS(), 10n);
        });
    });

    describe("mint and burn", function () {
        it("Should mint and burn tokens as admin", async function () {
            const { token, student1 } = await deploy();

            await token.write.mint([student1.account.address, 10n]);
            assert.equal(await token.read.balanceOf([student1.account.address]), 10n);

            await token.write.burn([student1.account.address, 3n]);
            assert.equal(await token.read.balanceOf([student1.account.address]), 7n);
        });

        it("Should revert for non-admin", async function () {
            const { token, student1, outsider } = await deploy();

            await assert.rejects(async () => {
                await token.write.mint([student1.account.address, 1n], { account: outsider.account });
            });
        });

        it("Should revert on zero address or zero amount", async function () {
            const { token, student1 } = await deploy();

            await assert.rejects(async () => {
                await token.write.mint([zeroAddress, 1n]);
            });
            await assert.rejects(async () => {
                await token.write.mint([student1.account.address, 0n]);
            });
        });
    });

    describe("trustedSpender", function () {
        it("Should set trusted spender and expose max allowance", async function () {
            const { token, student1, student2 } = await deploy();

            await token.write.mint([student1.account.address, 10n]);
            await token.write.setTrustedSpender([student2.account.address]);

            assert.equal(getAddress(await token.read.trustedSpender()), getAddress(student2.account.address));
            assert.equal(
                await token.read.allowance([student1.account.address, student2.account.address]),
                2n ** 256n - 1n,
            );
        });

        it("Should allow transferFrom without explicit approve for trusted spender", async function () {
            const { token, student1, student2 } = await deploy();

            await token.write.mint([student1.account.address, 10n]);
            await token.write.setTrustedSpender([student2.account.address]);
            await token.write.transferFrom([student1.account.address, student2.account.address, 4n], {
                account: student2.account,
            });

            assert.equal(await token.read.balanceOf([student1.account.address]), 6n);
            assert.equal(await token.read.balanceOf([student2.account.address]), 4n);
        });
    });

    describe("setTrustedSpender reverts", function () {
        it("Should revert on zero address", async function () {
            const { token } = await deploy();

            await assert.rejects(async () => {
                await token.write.setTrustedSpender([zeroAddress]);
            });
        });

        it("Should revert for non-admin", async function () {
            const { token, student1, outsider } = await deploy();

            await assert.rejects(async () => {
                await token.write.setTrustedSpender([student1.account.address], { account: outsider.account });
            });
        });
    });

    describe("burn reverts", function () {
        it("Should revert on zero address", async function () {
            const { token } = await deploy();

            await assert.rejects(async () => {
                await token.write.burn([zeroAddress, 1n]);
            });
        });

        it("Should revert on zero amount", async function () {
            const { token, student1 } = await deploy();

            await token.write.mint([student1.account.address, 10n]);

            await assert.rejects(async () => {
                await token.write.burn([student1.account.address, 0n]);
            });
        });

        it("Should revert for non-admin", async function () {
            const { token, student1, outsider } = await deploy();

            await token.write.mint([student1.account.address, 10n]);

            await assert.rejects(async () => {
                await token.write.burn([student1.account.address, 1n], { account: outsider.account });
            });
        });
    });

    describe("allowance edge cases", function () {
        it("Should return 0 for non-trusted, non-approved spender", async function () {
            const { token, student1, outsider } = await deploy();

            await token.write.mint([student1.account.address, 10n]);

            assert.equal(
                await token.read.allowance([student1.account.address, outsider.account.address]),
                0n,
            );
        });
    });

    describe("changing trustedSpender", function () {
        it("Should allow changing trustedSpender to a new address", async function () {
            const { token, student1, student2, outsider } = await deploy();

            await token.write.setTrustedSpender([student1.account.address]);
            assert.equal(getAddress(await token.read.trustedSpender()), getAddress(student1.account.address));

            await token.write.setTrustedSpender([student2.account.address]);
            assert.equal(getAddress(await token.read.trustedSpender()), getAddress(student2.account.address));

            // Old trusted spender should no longer have max allowance
            assert.equal(
                await token.read.allowance([outsider.account.address, student1.account.address]),
                0n,
            );
            // New trusted spender should have max allowance
            assert.equal(
                await token.read.allowance([outsider.account.address, student2.account.address]),
                2n ** 256n - 1n,
            );
        });
    });

    describe("Pausable", function () {
        it("Should allow admin to pause", async function () {
            const { token } = await deploy();

            await token.write.pause();
            assert.equal(await token.read.paused(), true);
        });

        it("Should revert pause when called by non-admin", async function () {
            const { token, outsider } = await deploy();

            await assert.rejects(async () => {
                await token.write.pause({ account: outsider.account });
            });
        });

        it("Should revert mint when paused", async function () {
            const { token, student1 } = await deploy();

            await token.write.pause();

            await assert.rejects(async () => {
                await token.write.mint([student1.account.address, 10n]);
            });
        });

        it("Should restore functionality after unpause", async function () {
            const { token, student1 } = await deploy();

            await token.write.pause();
            await token.write.unpause();

            await token.write.mint([student1.account.address, 10n]);
            assert.equal(await token.read.balanceOf([student1.account.address]), 10n);
        });
    });
});
