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

        const [, librarian, student1, student2, student3, outsider] = await viem.getWalletClients();
        const librarianRole = await campusRoles.read.LIBRARIAN_ROLE();
        const studentRole = await campusRoles.read.STUDENT_ROLE();

        await campusRoles.write.registerUser([librarian.account.address, "Librarian", librarianRole]);
        await campusRoles.write.registerUser([student1.account.address, "Student1", studentRole]);
        await campusRoles.write.registerUser([student2.account.address, "Student2", studentRole]);
        await campusRoles.write.registerUser([student3.account.address, "Student3", studentRole]);

        await libraryToken.write.setTrustedSpender([libraryManager.address]);
        await libraryToken.write.mint([student1.account.address, 10n]);
        await libraryToken.write.mint([student2.account.address, 10n]);
        await libraryToken.write.mint([student3.account.address, 10n]);

        return { campusRoles, libraryToken, libraryManager, librarian, student1, student2, student3, outsider };
    }

    // LoanStatus: 0=None, 1=Queued, 2=Reserved, 3=PickedUp, 4=Returned, 5=Cancelled

    describe("Deployment", function () {
        it("Should set references and constants", async function () {
            const { libraryManager, campusRoles, libraryToken } = await deploySystem();
            assert.equal(getAddress(await libraryManager.read.campusRoles()), getAddress(campusRoles.address));
            assert.equal(getAddress(await libraryManager.read.libraryToken()), getAddress(libraryToken.address));
            assert.equal(await libraryManager.read.DEPOSIT_PER_LOAN(), 1n);
            assert.equal(await libraryManager.read.DEFAULT_LOAN_DURATION(), BigInt(21 * 24 * 60 * 60));
            assert.equal(await libraryManager.read.RESERVATION_TIMEOUT(), BigInt(3 * 24 * 60 * 60));
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

        it("Should add copies and process queue", async function () {
            const { libraryManager, libraryToken, librarian, student1, student2 } = await deploySystem();

            // Book with 1 copy
            await libraryManager.write.addBook([1n], { account: librarian.account });

            // Student1 gets reserved, student2 gets queued
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.requestLoan([1n], { account: student2.account });

            const loan2Before = await libraryManager.read.getLoanInfo([2n]);
            assert.equal(loan2Before.status, 1); // Queued

            // Add 1 copy → student2 should auto-reserve
            await libraryManager.write.addCopies([1n, 1n], { account: librarian.account });

            const loan2After = await libraryManager.read.getLoanInfo([2n]);
            assert.equal(loan2After.status, 2); // Reserved
        });
    });

    describe("Main loan flow", function () {
        it("Should execute request (RESERVED) → confirmPickup → confirmReturn", async function () {
            const { libraryManager, libraryToken, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });

            // Request → RESERVED (copies available)
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n); // deposit locked

            const loan = await libraryManager.read.getLoanInfo([1n]);
            assert.equal(loan.status, 2); // Reserved
            assert.ok(loan.reservationDate > 0n);
            assert.equal(await libraryManager.read.reservedCopiesForBook([1n]), 1n);

            // Librarian confirms pickup
            await libraryManager.write.confirmPickup([1n], { account: librarian.account });

            const loanAfterPickup = await libraryManager.read.getLoanInfo([1n]);
            assert.equal(loanAfterPickup.status, 3); // PickedUp
            assert.ok(loanAfterPickup.pickupDate > 0n);
            assert.ok(loanAfterPickup.dueDate > 0n);
            assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 1n); // has book
            assert.equal(await libraryManager.read.reservedCopiesForBook([1n]), 0n);
            assert.equal(await libraryManager.read.activeLoansForBook([1n]), 1n);

            // Librarian confirms return
            await libraryManager.write.confirmReturn([1n], { account: librarian.account });

            const loanAfterReturn = await libraryManager.read.getLoanInfo([1n]);
            assert.equal(loanAfterReturn.status, 4); // Returned
            assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 0n);
            assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 10n); // deposit returned
            assert.equal(await libraryManager.read.activeLoansForBook([1n]), 0n);
        });

        it("Should force return overdue loan without returning deposit", async function () {
            const { libraryManager, libraryToken, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.confirmPickup([1n], { account: librarian.account });

            await increaseTime(21 * 24 * 60 * 60 + 1);
            await libraryManager.write.forceReturn([1n], { account: librarian.account });

            assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 0n);
            assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n); // deposit NOT returned
        });
    });

    describe("Queue system", function () {
        it("Should queue when no copies available", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });

            // Student1 gets reserved (1 copy available)
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            const loan1 = await libraryManager.read.getLoanInfo([1n]);
            assert.equal(loan1.status, 2); // Reserved

            // Student2 gets queued (0 copies available)
            await libraryManager.write.requestLoan([1n], { account: student2.account });
            const loan2 = await libraryManager.read.getLoanInfo([2n]);
            assert.equal(loan2.status, 1); // Queued

            assert.equal(await libraryManager.read.getQueuePosition([2n]), 1n);
            assert.equal(await libraryManager.read.getQueueLength([1n]), 1n);
        });

        it("Should auto-reserve next in queue when copy returned", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });

            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.requestLoan([1n], { account: student2.account });

            // Student2 is queued
            assert.equal((await libraryManager.read.getLoanInfo([2n])).status, 1); // Queued

            // Student1 picks up and returns
            await libraryManager.write.confirmPickup([1n], { account: librarian.account });
            await libraryManager.write.confirmReturn([1n], { account: librarian.account });

            // Student2 should now be RESERVED
            const loan2 = await libraryManager.read.getLoanInfo([2n]);
            assert.equal(loan2.status, 2); // Reserved
            assert.ok(loan2.reservationDate > 0n);
        });

        it("Should auto-reserve next in queue when reservation cancelled", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });

            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.requestLoan([1n], { account: student2.account });

            // Student1 cancels reservation → student2 should auto-reserve
            await libraryManager.write.cancelLoan([1n], { account: student1.account });

            const loan2 = await libraryManager.read.getLoanInfo([2n]);
            assert.equal(loan2.status, 2); // Reserved
        });

        it("Should handle 2 copies, 3 requests correctly", async function () {
            const { libraryManager, librarian, student1, student2, student3 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });

            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.requestLoan([1n], { account: student2.account });
            await libraryManager.write.requestLoan([1n], { account: student3.account });

            assert.equal((await libraryManager.read.getLoanInfo([1n])).status, 2); // Reserved
            assert.equal((await libraryManager.read.getLoanInfo([2n])).status, 2); // Reserved
            assert.equal((await libraryManager.read.getLoanInfo([3n])).status, 1); // Queued
            assert.equal(await libraryManager.read.getQueuePosition([3n]), 1n);
        });

        it("Should return correct queue position", async function () {
            const { libraryManager, libraryToken, librarian, student1, student2, student3 } = await deploySystem();

            await libraryManager.write.addBook([0n], { account: librarian.account }).catch(() => {});
            // Need a book with 0 available — create with 1 copy and reserve it
            await libraryManager.write.addBook([1n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account }); // Reserved

            await libraryManager.write.requestLoan([1n], { account: student2.account }); // Queued #1
            await libraryManager.write.requestLoan([1n], { account: student3.account }); // Queued #2

            assert.equal(await libraryManager.read.getQueuePosition([2n]), 1n);
            assert.equal(await libraryManager.read.getQueuePosition([3n]), 2n);
            assert.equal(await libraryManager.read.getQueueLength([1n]), 2n);
        });
    });

    describe("Cancel loan", function () {
        it("Should cancel QUEUED loan and return deposit", async function () {
            const { libraryManager, libraryToken, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account }); // Reserved
            await libraryManager.write.requestLoan([1n], { account: student2.account }); // Queued
            assert.equal(await libraryToken.read.balanceOf([student2.account.address]), 9n);

            await libraryManager.write.cancelLoan([2n], { account: student2.account });

            assert.equal((await libraryManager.read.getLoanInfo([2n])).status, 5); // Cancelled
            assert.equal(await libraryToken.read.balanceOf([student2.account.address]), 10n); // deposit returned
            assert.equal(await libraryManager.read.activeLoanByStudentAndBook([student2.account.address, 1n]), 0n);
        });

        it("Should cancel RESERVED loan, return deposit and process queue", async function () {
            const { libraryManager, libraryToken, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account }); // Reserved
            await libraryManager.write.requestLoan([1n], { account: student2.account }); // Queued

            await libraryManager.write.cancelLoan([1n], { account: student1.account });

            assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 10n);
            // Student2 should now be reserved
            assert.equal((await libraryManager.read.getLoanInfo([2n])).status, 2); // Reserved
        });

        it("Should revert cancel for PICKED_UP loan", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.confirmPickup([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.cancelLoan([1n], { account: student1.account });
            });
        });
    });

    describe("Reservation expiry", function () {
        it("Should expire reservation after timeout", async function () {
            const { libraryManager, libraryToken, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });

            await increaseTime(3 * 24 * 60 * 60 + 1); // 3 days + 1 second

            assert.equal(await libraryManager.read.isReservationExpired([1n]), true);

            await libraryManager.write.expireReservation([1n], { account: librarian.account });

            assert.equal((await libraryManager.read.getLoanInfo([1n])).status, 5); // Cancelled
            assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 10n);
        });

        it("Should revert expireReservation before timeout", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });

            assert.equal(await libraryManager.read.isReservationExpired([1n]), false);

            await assert.rejects(async () => {
                await libraryManager.write.expireReservation([1n], { account: librarian.account });
            });
        });

        it("Should auto-reserve next in queue after expiry", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([1n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account }); // Reserved
            await libraryManager.write.requestLoan([1n], { account: student2.account }); // Queued

            await increaseTime(3 * 24 * 60 * 60 + 1);
            await libraryManager.write.expireReservation([1n], { account: librarian.account });

            // Student2 should now be reserved
            assert.equal((await libraryManager.read.getLoanInfo([2n])).status, 2); // Reserved
        });
    });

    describe("Transfer restriction", function () {
        it("Should block student-to-student transfers", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();

            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.confirmPickup([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await libraryManager.write.safeTransferFrom([
                    student1.account.address, student2.account.address, 1n, 1n, "0x",
                ], { account: student1.account });
            });
        });
    });

    describe("Revert paths", function () {
        it("requestLoan: already borrowing (pending)", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([1n], { account: student1.account });
            });
        });

        it("requestLoan: insufficient deposit", async function () {
            const { libraryManager, libraryToken, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryToken.write.burn([student1.account.address, 10n]);
            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([1n], { account: student1.account });
            });
        });

        it("requestLoan: book not found", async function () {
            const { libraryManager, student1 } = await deploySystem();
            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([999n], { account: student1.account });
            });
        });

        it("requestLoan: not a student", async function () {
            const { libraryManager, librarian, outsider } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([1n], { account: outsider.account });
            });
        });

        it("confirmPickup: not RESERVED", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();
            await libraryManager.write.addBook([1n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account }); // Reserved
            await libraryManager.write.requestLoan([1n], { account: student2.account }); // Queued
            await assert.rejects(async () => {
                await libraryManager.write.confirmPickup([2n], { account: librarian.account }); // Queued, not Reserved
            });
        });

        it("confirmReturn: not PICKED_UP", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await assert.rejects(async () => {
                await libraryManager.write.confirmReturn([1n], { account: librarian.account }); // Reserved, not PickedUp
            });
        });

        it("forceReturn: not overdue", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.confirmPickup([1n], { account: librarian.account });
            await assert.rejects(async () => {
                await libraryManager.write.forceReturn([1n], { account: librarian.account });
            });
        });

        it("cancelLoan: not owner", async function () {
            const { libraryManager, librarian, student1, student2 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await assert.rejects(async () => {
                await libraryManager.write.cancelLoan([1n], { account: student2.account });
            });
        });

        it("removeBook: has active reservations", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account }); // Reserved
            await assert.rejects(async () => {
                await libraryManager.write.removeBook([1n], { account: librarian.account });
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
            assert.equal(loan.status, 2); // Reserved
            assert.ok(loan.requestDate > 0n);
            assert.ok(loan.reservationDate > 0n);
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

        it("getAvailableCopies should account for reservations", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([3n], { account: librarian.account });
            assert.equal(await libraryManager.read.getAvailableCopies([1n]), 3n);

            await libraryManager.write.requestLoan([1n], { account: student1.account }); // Reserved
            assert.equal(await libraryManager.read.getAvailableCopies([1n]), 2n); // 3 held - 1 reserved

            await libraryManager.write.confirmPickup([1n], { account: librarian.account }); // PickedUp
            assert.equal(await libraryManager.read.getAvailableCopies([1n]), 2n); // 2 held - 0 reserved

            await libraryManager.write.confirmReturn([1n], { account: librarian.account });
            assert.equal(await libraryManager.read.getAvailableCopies([1n]), 3n); // 3 held - 0 reserved
        });

        it("isOverdue should work correctly", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            await libraryManager.write.confirmPickup([1n], { account: librarian.account });

            assert.equal(await libraryManager.read.isOverdue([1n]), false);
            await increaseTime(21 * 24 * 60 * 60 + 1);
            assert.equal(await libraryManager.read.isOverdue([1n]), true);
        });
    });

    describe("Pausable", function () {
        it("Should allow admin to pause and unpause", async function () {
            const { libraryManager } = await deploySystem();
            await libraryManager.write.pause();
            assert.equal(await libraryManager.read.paused(), true);
            await libraryManager.write.unpause();
            assert.equal(await libraryManager.read.paused(), false);
        });

        it("Should revert pause when called by non-admin", async function () {
            const { libraryManager, outsider } = await deploySystem();
            await assert.rejects(async () => {
                await libraryManager.write.pause({ account: outsider.account });
            });
        });

        it("Should revert unpause when called by non-admin", async function () {
            const { libraryManager, outsider } = await deploySystem();
            await libraryManager.write.pause();
            await assert.rejects(async () => {
                await libraryManager.write.unpause({ account: outsider.account });
            });
        });

        it("Should revert requestLoan when paused", async function () {
            const { libraryManager, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryManager.write.pause();
            await assert.rejects(async () => {
                await libraryManager.write.requestLoan([1n], { account: student1.account });
            });
        });

        it("Should restore functionality after unpause", async function () {
            const { libraryManager, libraryToken, librarian, student1 } = await deploySystem();
            await libraryManager.write.addBook([2n], { account: librarian.account });
            await libraryToken.write.mint([student1.account.address, 5n]);
            await libraryManager.write.pause();
            await libraryManager.write.unpause();
            // Tras unpause, requestLoan vuelve a funcionar.
            await libraryManager.write.requestLoan([1n], { account: student1.account });
            assert.equal(await libraryManager.read.paused(), false);
        });
    });
});
