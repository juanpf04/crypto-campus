import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

describe("LibraryManager", async function () {
    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();

    async function increaseTime(seconds: number) {
        await publicClient.transport.request({ method: "evm_increaseTime" as never, params: [seconds] as never });
        await publicClient.transport.request({ method: "evm_mine" as never, params: [] as never });
    }

    async function deploySystem() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const libraryToken = await viem.deployContract("LibraryToken", [campusRoles.address]);
        const libraryManager = await viem.deployContract("LibraryManager", [
            campusRoles.address,
            libraryToken.address,
            "https://library.ucm.es/",
        ]);

        const [, librarian, student1, student2, outsider] = await viem.getWalletClients();
        const librarianRole = await campusRoles.read.LIBRARIAN_ROLE();
        const studentRole = await campusRoles.read.STUDENT_ROLE();

        await campusRoles.write.registerUser([librarian.account.address, "Librarian", librarianRole]);
        await campusRoles.write.registerUser([student1.account.address, "Student1", studentRole]);
        await campusRoles.write.registerUser([student2.account.address, "Student2", studentRole]);

        await libraryToken.write.setTrustedSpender([libraryManager.address]);
        await libraryToken.write.mint([student1.account.address, 10n]);
        await libraryToken.write.mint([student2.account.address, 10n]);

        return { campusRoles, libraryToken, libraryManager, librarian, student1, student2, outsider };
    }

    describe("Deployment", function () {
        it("Should set references and constants", async function () {
            const { libraryManager, campusRoles, libraryToken } = await deploySystem();
            assert.equal(getAddress(await libraryManager.read.campusRoles()), getAddress(campusRoles.address));
            assert.equal(getAddress(await libraryManager.read.libraryToken()), getAddress(libraryToken.address));
            assert.equal(await libraryManager.read.DEPOSIT_PER_LOAN(), 1n);
            assert.equal(await libraryManager.read.nextBookId(), 1n);
            assert.equal(await libraryManager.read.nextLoanId(), 1n);
        });
    });

    describe("Book management", function () {
        it("Should add and remove books", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await libraryManager.write.addBook([3n], { account: librarian.account });
            const [totalCopies, availableCopies, exists] = await libraryManager.read.getBookInfo([1n]);
            assert.equal(totalCopies, 3n);
            assert.equal(availableCopies, 3n);
            assert.equal(exists, true);

            await libraryManager.write.removeBook([1n], { account: librarian.account });
            const [, availableAfter, existsAfter] = await libraryManager.read.getBookInfo([1n]);
            assert.equal(availableAfter, 0n);
            assert.equal(existsAfter, false);
        });

        it("Should revert addBook for non-librarian", async function () {
            const { libraryManager, student1 } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.addBook([1n], { account: student1.account });
            });
        });
    });

    describe("Loan flow", function () {
        it("Should execute request -> approve -> confirmReturn", async function () {
            const { libraryManager, libraryToken, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 1n);
            assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n);

            await libraryManager.write.confirmReturn([1n], { account: librarian.account });
            assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 0n);
            assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 10n);
        });

        it("Should force return overdue loan without returning deposit", async function () {
            const { libraryManager, libraryToken, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await increaseTime(21 * 24 * 60 * 60 + 1);
            await libraryManager.write.forceReturn([1n], { account: librarian.account });

            assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 0n);
            assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n);
        });

        it("Should reject invalid transitions", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.approveLoan([1n], { account: librarian.account });
            });

            await assert.rejects(async () => {
                await libraryManager.write.cancelLoanRequest([1n], { account: student1.account });
            });
        });
    });

    describe("Transfer restriction", function () {
        it("Should block student-to-student transfers", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.safeTransferFrom([
                    student1.account.address,
                    student2.account.address,
                    1n,
                    1n,
                    "0x",
                ], { account: student1.account });
            });
        });
    });
});
