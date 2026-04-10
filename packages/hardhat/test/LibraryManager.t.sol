// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";
import { LibraryManager } from "../contracts/LibraryManager.sol";

/// @title LibraryManagerTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas del sistema de colas con auto-reserva para LibraryManager.
contract LibraryManagerTest is Test {

    CampusRoles campusRoles;
    LibraryToken libraryToken;
    LibraryManager libraryManager;

    address librarian;
    address student;
    address student2;
    address student3;
    address outsider;

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));
        libraryManager = new LibraryManager(address(campusRoles), address(libraryToken), "https://library.ucm.es/");

        librarian = makeAddr("librarian");
        student = makeAddr("student");
        student2 = makeAddr("student2");
        student3 = makeAddr("student3");
        outsider = makeAddr("outsider");

        campusRoles.registerUser(librarian, "Librarian", campusRoles.LIBRARIAN_ROLE());
        campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());
        campusRoles.registerUser(student2, "Student2", campusRoles.STUDENT_ROLE());
        campusRoles.registerUser(student3, "Student3", campusRoles.STUDENT_ROLE());

        libraryToken.setTrustedSpender(address(libraryManager));
        libraryToken.mint(student, 10);
        libraryToken.mint(student2, 10);
        libraryToken.mint(student3, 10);

        vm.prank(librarian);
        libraryManager.addBook(2);
    }

    // ── Main flow ───────────────────────────────────────────────────────

    function test_RequestReservedPickupReturn() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        // Deposit locked, status = Reserved
        assertEq(libraryToken.balanceOf(student), 9);
        LibraryManager.Loan memory loan = libraryManager.getLoanInfo(1);
        assertEq(uint256(loan.status), uint256(LibraryManager.LoanStatus.Reserved));

        // Librarian confirms pickup
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        assertEq(libraryManager.balanceOf(student, 1), 1);
        loan = libraryManager.getLoanInfo(1);
        assertEq(uint256(loan.status), uint256(LibraryManager.LoanStatus.PickedUp));

        // Librarian confirms return
        vm.prank(librarian);
        libraryManager.confirmReturn(1);

        assertEq(libraryManager.balanceOf(student, 1), 0);
        assertEq(libraryToken.balanceOf(student), 10); // deposit returned
    }

    function test_ForceReturnOverdueKeepsDeposit() public {
        vm.prank(student);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        vm.warp(block.timestamp + 22 days);

        vm.prank(librarian);
        libraryManager.forceReturn(1);

        assertEq(libraryManager.balanceOf(student, 1), 0);
        assertEq(libraryToken.balanceOf(student), 9); // deposit NOT returned
    }

    // ── Queue system ────────────────────────────────────────────────────

    function test_QueueWhenNoCopies() public {
        // 2 copies, 3 requests → 2 reserved, 1 queued
        vm.prank(student);
        libraryManager.requestLoan(1);
        vm.prank(student2);
        libraryManager.requestLoan(1);
        vm.prank(student3);
        libraryManager.requestLoan(1);

        assertEq(uint256(libraryManager.getLoanInfo(1).status), uint256(LibraryManager.LoanStatus.Reserved));
        assertEq(uint256(libraryManager.getLoanInfo(2).status), uint256(LibraryManager.LoanStatus.Reserved));
        assertEq(uint256(libraryManager.getLoanInfo(3).status), uint256(LibraryManager.LoanStatus.Queued));
        assertEq(libraryManager.getQueuePosition(3), 1);
    }

    function test_AutoReserveOnReturn() public {
        vm.prank(student);
        libraryManager.requestLoan(1); // Reserved (loan 1)
        vm.prank(student2);
        libraryManager.requestLoan(1); // Reserved (loan 2)
        vm.prank(student3);
        libraryManager.requestLoan(1); // Queued (loan 3)

        // Student1 picks up and returns
        vm.prank(librarian);
        libraryManager.confirmPickup(1);
        vm.prank(librarian);
        libraryManager.confirmReturn(1);

        // Student3 should now be Reserved
        assertEq(uint256(libraryManager.getLoanInfo(3).status), uint256(LibraryManager.LoanStatus.Reserved));
    }

    function test_AutoReserveOnCancel() public {
        vm.prank(student);
        libraryManager.requestLoan(1); // Reserved (loan 1)
        vm.prank(student2);
        libraryManager.requestLoan(1); // Reserved (loan 2)
        vm.prank(student3);
        libraryManager.requestLoan(1); // Queued (loan 3)

        // Student1 cancels → copy freed → student3 auto-reserved
        vm.prank(student);
        libraryManager.cancelLoan(1);

        assertEq(uint256(libraryManager.getLoanInfo(3).status), uint256(LibraryManager.LoanStatus.Reserved));
        assertEq(libraryToken.balanceOf(student), 10); // deposit returned
    }

    // ── Cancel ──────────────────────────────────────────────────────────

    function test_CancelQueuedReturnsDeposit() public {
        vm.prank(student);
        libraryManager.requestLoan(1); // Reserved
        vm.prank(student2);
        libraryManager.requestLoan(1); // Reserved
        vm.prank(student3);
        libraryManager.requestLoan(1); // Queued

        vm.prank(student3);
        libraryManager.cancelLoan(3);

        assertEq(uint256(libraryManager.getLoanInfo(3).status), uint256(LibraryManager.LoanStatus.Cancelled));
        assertEq(libraryToken.balanceOf(student3), 10);
    }

    function test_CancelReservedReturnsDeposit() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(student);
        libraryManager.cancelLoan(1);

        assertEq(uint256(libraryManager.getLoanInfo(1).status), uint256(LibraryManager.LoanStatus.Cancelled));
        assertEq(libraryToken.balanceOf(student), 10);
    }

    function test_RevertCancelPickedUp() public {
        vm.prank(student);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.NotQueuedOrReserved.selector, 1));
        libraryManager.cancelLoan(1);
    }

    // ── Reservation expiry ──────────────────────────────────────────────

    function test_ExpireReservation() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.warp(block.timestamp + 3 days + 1);

        assertTrue(libraryManager.isReservationExpired(1));

        vm.prank(librarian);
        libraryManager.expireReservation(1);

        assertEq(uint256(libraryManager.getLoanInfo(1).status), uint256(LibraryManager.LoanStatus.Cancelled));
        assertEq(libraryToken.balanceOf(student), 10);
    }

    function test_RevertExpireBeforeTimeout() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.ReservationNotExpired.selector, 1));
        libraryManager.expireReservation(1);
    }

    function test_ExpireAutoReservesNext() public {
        vm.prank(student);
        libraryManager.requestLoan(1); // Reserved
        vm.prank(student2);
        libraryManager.requestLoan(1); // Reserved
        vm.prank(student3);
        libraryManager.requestLoan(1); // Queued

        vm.warp(block.timestamp + 3 days + 1);

        vm.prank(librarian);
        libraryManager.expireReservation(1); // student1's reservation expired

        // student3 should now be Reserved
        assertEq(uint256(libraryManager.getLoanInfo(3).status), uint256(LibraryManager.LoanStatus.Reserved));
    }

    // ── Revert paths ────────────────────────────────────────────────────

    function test_RevertRequestLoanNotStudent() public {
        vm.prank(outsider);
        vm.expectRevert(LibraryManager.NotStudent.selector);
        libraryManager.requestLoan(1);
    }

    function test_RevertRequestLoanAlreadyBorrowing() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.AlreadyBorrowingBook.selector, student, 1));
        libraryManager.requestLoan(1);
    }

    function test_RevertRequestLoanInsufficientDeposit() public {
        libraryToken.burn(student, 10);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.InsufficientDeposit.selector, student));
        libraryManager.requestLoan(1);
    }

    function test_RevertForceReturnNotOverdue() public {
        vm.prank(student);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.LoanNotOverdue.selector, 1));
        libraryManager.forceReturn(1);
    }

    // ── Pausable ────────────────────────────────────────────────────────

    function test_PauseAndUnpause() public {
        libraryManager.pause();

        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        libraryManager.addBook(1);

        libraryManager.unpause();

        vm.prank(librarian);
        libraryManager.addBook(1);
    }

    // ── View functions ──────────────────────────────────────────────────

    function test_IsOverdue() public {
        vm.prank(student);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        assertFalse(libraryManager.isOverdue(1));
        vm.warp(block.timestamp + 22 days);
        assertTrue(libraryManager.isOverdue(1));
    }

    function test_GetAvailableCopiesAccountsForReservations() public {
        assertEq(libraryManager.getAvailableCopies(1), 2);

        vm.prank(student);
        libraryManager.requestLoan(1); // Reserved → 1 available
        assertEq(libraryManager.getAvailableCopies(1), 1);

        vm.prank(librarian);
        libraryManager.confirmPickup(1); // PickedUp → 1 available (1 held, 0 reserved)
        assertEq(libraryManager.getAvailableCopies(1), 1);

        vm.prank(librarian);
        libraryManager.confirmReturn(1); // Returned → 2 available
        assertEq(libraryManager.getAvailableCopies(1), 2);
    }
}
