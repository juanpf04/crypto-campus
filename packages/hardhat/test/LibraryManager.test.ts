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

    // ── Additional tests ────────────────────────────────────────────────

    describe("addCopies", function () {
        it("Should add copies to an existing book", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            const [totalBefore, availBefore] = await libraryManager.read.getBookInfo([1n]);
            assert.equal(totalBefore, 2n);
            assert.equal(availBefore, 2n);

            await libraryManager.write.addCopies([1n, 3n], { account: librarian.account });
            const [totalAfter, availAfter] = await libraryManager.read.getBookInfo([1n]);
            assert.equal(totalAfter, 5n);
            assert.equal(availAfter, 5n);
        });

        it("Should revert on non-existent book (BookNotFound)", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.addCopies([999n, 1n], { account: librarian.account });
            });
        });

        it("Should revert on amount=0 (ZeroCopies)", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.addCopies([1n, 0n], { account: librarian.account });
            });
        });

        it("Should revert for non-librarian (NotLibrarian)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.addCopies([1n, 2n], { account: student1.account });
            });
        });
    });

    describe("rejectLoan", function () {
        it("Should reject a Requested loan", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });

            await libraryManager.write.rejectLoan([1n, "Not available"], { account: librarian.account });

            const loan = await libraryManager.read.getLoanInfo([1n]);
            // LoanStatus: 0=None, 1=Requested, 2=Approved, 3=Rejected, 4=Returned
            assert.equal(loan.status, 3);
        });

        it("Should revert on non-existent loan (LoanNotFound)", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.rejectLoan([999n, "reason"], { account: librarian.account });
            });
        });

        it("Should revert on non-Requested loan (InvalidLoanState)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.rejectLoan([1n, "too late"], { account: librarian.account });
            });
        });

        it("Should revert for non-librarian (NotLibrarian)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });

            await assert.rejects(async () => {
                await libraryManager.write.rejectLoan([1n, "reason"], { account: student1.account });
            });
        });
    });

    describe("isOverdue", function () {
        it("Should return true for approved loan past due date", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await increaseTime(21 * 24 * 60 * 60 + 1);

            const overdue = await libraryManager.read.isOverdue([1n]);
            assert.equal(overdue, true);
        });

        it("Should return false for approved loan not yet due", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            const overdue = await libraryManager.read.isOverdue([1n]);
            assert.equal(overdue, false);
        });

        it("Should return false for returned loan", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });
            await libraryManager.write.confirmReturn([1n], { account: librarian.account });

            const overdue = await libraryManager.read.isOverdue([1n]);
            assert.equal(overdue, false);
        });
    });

    describe("addBook revert paths", function () {
        it("Should revert on copies=0 (ZeroCopies)", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.addBook([0n], { account: librarian.account });
            });
        });
    });

    describe("removeBook revert paths", function () {
        it("Should revert on non-existent book (BookNotFound)", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.removeBook([999n], { account: librarian.account });
            });
        });

        it("Should revert when active loans exist (BookHasActiveLoans)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.removeBook([1n], { account: librarian.account });
            });
        });
    });

    describe("requestLoan revert paths", function () {
        it("Should revert on non-existent book (BookNotFound)", async function () {
            const { libraryManager, student1 } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([999n], { account: student1.account });
            });
        });

        it("Should revert when no copies available (BookNotAvailable)", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([1n], { account: student2.account });
            });
        });

        it("Should revert when already borrowing (AlreadyBorrowingBook)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([1n], { account: student1.account });
            });
        });

        it("Should revert for non-student (NotStudent)", async function () {
            const { libraryManager, librarian, outsider } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([1n], { account: outsider.account });
            });
        });
    });

    describe("cancelLoanRequest revert paths", function () {
        it("Should revert on non-existent loan (LoanNotFound)", async function () {
            const { libraryManager, student1 } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.cancelLoanRequest([999n], { account: student1.account });
            });
        });

        it("Should revert when not the loan owner (NotLoanOwner)", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });

            await assert.rejects(async () => {
                await libraryManager.write.cancelLoanRequest([1n], { account: student2.account });
            });
        });
    });

    describe("approveLoan revert paths", function () {
        it("Should revert on non-existent loan (LoanNotFound)", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.approveLoan([999n], { account: librarian.account });
            });
        });

        it("Should revert for non-librarian (NotLibrarian)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });

            await assert.rejects(async () => {
                await libraryManager.write.approveLoan([1n], { account: student1.account });
            });
        });
    });

    describe("confirmReturn revert paths", function () {
        it("Should revert on non-existent loan (LoanNotFound)", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.confirmReturn([999n], { account: librarian.account });
            });
        });

        it("Should revert on wrong state (InvalidLoanState)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });

            await assert.rejects(async () => {
                await libraryManager.write.confirmReturn([1n], { account: librarian.account });
            });
        });

        it("Should revert for non-librarian (NotLibrarian)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.confirmReturn([1n], { account: student1.account });
            });
        });
    });

    describe("forceReturn revert paths", function () {
        it("Should revert when loan is NOT overdue (LoanNotOverdue)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.forceReturn([1n], { account: librarian.account });
            });
        });

        it("Should revert for non-librarian (NotLibrarian)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });

            await increaseTime(21 * 24 * 60 * 60 + 1);

            await assert.rejects(async () => {
                await libraryManager.write.forceReturn([1n], { account: student1.account });
            });
        });
    });

    describe("View functions", function () {
        it("getLoanInfo should return correct struct", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });

            const loan = await libraryManager.read.getLoanInfo([1n]);
            assert.equal(loan.bookId, 1n);
            assert.equal(getAddress(loan.student), getAddress(student1.account.address));
            assert.equal(loan.status, 1); // Requested
            assert.ok(loan.requestDate > 0n);
            assert.equal(BigInt(loan.approvalDate), 0n);
            assert.equal(BigInt(loan.dueDate), 0n);
            assert.equal(BigInt(loan.returnDate), 0n);
        });

        it("getStudentLoans should return correct array", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([3n], { account: librarian.account });
            await libraryManager.write.addBook([3n], { account: librarian.account });

            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.requestLoan([2n], { account: student1.account });

            const loans = await libraryManager.read.getStudentLoans([student1.account.address]);
            assert.equal(loans.length, 2);
            assert.equal(loans[0], 1n);
            assert.equal(loans[1], 2n);
        });

        it("getAvailableCopies should return correct value", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([3n], { account: librarian.account });
            assert.equal(await libraryManager.read.getAvailableCopies([1n]), 3n);

            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.approveLoan([1n], { account: librarian.account });
            assert.equal(await libraryManager.read.getAvailableCopies([1n]), 2n);

            await libraryManager.write.confirmReturn([1n], { account: librarian.account });
            assert.equal(await libraryManager.read.getAvailableCopies([1n]), 3n);
        });
    });

    describe("Pausable", function () {
        it("Should allow admin to pause", async function () {
            const { libraryManager } = await deploySystem();

            await libraryManager.write.pause();
            assert.equal(await libraryManager.read.paused(), true);
        });

        it("Should revert pause when called by non-admin", async function () {
            const { libraryManager, outsider } = await deploySystem();

            await assert.rejects(async () => {
                await libraryManager.write.pause({ account: outsider.account });
            });
        });

        it("Should revert addBook when paused", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await libraryManager.write.pause();

            await assert.rejects(async () => {
                await libraryManager.write.addBook([2n], { account: librarian.account });
            });
        });

        it("Should restore functionality after unpause", async function () {
            const { libraryManager, librarian } = await deploySystem();

            await libraryManager.write.pause();
            await libraryManager.write.unpause();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            const [totalCopies, , exists] = await libraryManager.read.getBookInfo([1n]);
            assert.equal(totalCopies, 2n);
            assert.equal(exists, true);
        });
    });
});
