// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";
import { LibraryManager } from "../contracts/LibraryManager.sol";

contract LibraryManagerTest is Test {
    CampusRoles campusRoles;
    LibraryToken libraryToken;
    LibraryManager libraryManager;

    address librarian;
    address student;
    address outsider;

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));
        libraryManager = new LibraryManager(address(campusRoles), address(libraryToken), "https://library.ucm.es/");

        librarian = makeAddr("librarian");
        student = makeAddr("student");
        outsider = makeAddr("outsider");

        campusRoles.registerUser(librarian, "Librarian", campusRoles.LIBRARIAN_ROLE());
        campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());

        libraryToken.setTrustedSpender(address(libraryManager));
        libraryToken.mint(student, 10);

        vm.prank(librarian);
        libraryManager.addBook(2);
    }

    function test_RequestApproveAndConfirmReturn() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.approveLoan(1);

        assertEq(libraryManager.balanceOf(student, 1), 1);
        assertEq(libraryToken.balanceOf(student), 9);

        vm.prank(librarian);
        libraryManager.confirmReturn(1);

        assertEq(libraryManager.balanceOf(student, 1), 0);
        assertEq(libraryToken.balanceOf(student), 10);
    }

    function test_ForceReturnOverdueKeepsDeposit() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.approveLoan(1);

        vm.warp(block.timestamp + 22 days);

        vm.prank(librarian);
        libraryManager.forceReturn(1);

        assertEq(libraryManager.balanceOf(student, 1), 0);
        assertEq(libraryToken.balanceOf(student), 9);
    }

    function test_AddCopies() public {
        (uint256 totalBefore, uint256 availableBefore, ) = libraryManager.getBookInfo(1);

        vm.prank(librarian);
        libraryManager.addCopies(1, 3);

        (uint256 totalAfter, uint256 availableAfter, ) = libraryManager.getBookInfo(1);
        assertEq(totalAfter, totalBefore + 3);
        assertEq(availableAfter, availableBefore + 3);
    }

    function test_RevertAddCopiesBookNotFound() public {
        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.BookNotFound.selector, 999));
        libraryManager.addCopies(999, 1);
    }

    function test_RevertAddCopiesZero() public {
        vm.prank(librarian);
        vm.expectRevert(LibraryManager.ZeroCopies.selector);
        libraryManager.addCopies(1, 0);
    }

    function test_RejectLoan() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.rejectLoan(1, "Not available");

        LibraryManager.Loan memory loan = libraryManager.getLoanInfo(1);
        assertEq(uint256(loan.status), uint256(LibraryManager.LoanStatus.Rejected));
    }

    function test_RevertAddBookZeroCopies() public {
        vm.prank(librarian);
        vm.expectRevert(LibraryManager.ZeroCopies.selector);
        libraryManager.addBook(0);
    }

    function test_RevertRemoveBookWithActiveLoans() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.approveLoan(1);

        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.BookHasActiveLoans.selector, 1));
        libraryManager.removeBook(1);
    }

    function test_RevertRequestLoanNotStudent() public {
        vm.prank(outsider);
        vm.expectRevert(LibraryManager.NotStudent.selector);
        libraryManager.requestLoan(1);
    }

    function test_RevertForceReturnNotOverdue() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.approveLoan(1);

        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.LoanNotOverdue.selector, 1));
        libraryManager.forceReturn(1);
    }

    function test_CancelLoanRequest() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(student);
        libraryManager.cancelLoanRequest(1);

        LibraryManager.Loan memory loan = libraryManager.getLoanInfo(1);
        // cancelLoanRequest sets status to Rejected (reused for cancellations)
        assertEq(uint256(loan.status), uint256(LibraryManager.LoanStatus.Rejected));
    }

    function test_PauseAndUnpause() public {
        // Admin pauses the contract
        libraryManager.pause();

        // Adding a book reverts while paused
        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        libraryManager.addBook(1);

        // Admin unpauses
        libraryManager.unpause();

        // Now it works again
        vm.prank(librarian);
        libraryManager.addBook(1);
    }

    function test_IsOverdue() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.approveLoan(1);

        assertFalse(libraryManager.isOverdue(1));

        // Warp past the due date (DEFAULT_LOAN_DURATION = 21 days)
        vm.warp(block.timestamp + 22 days);

        assertTrue(libraryManager.isOverdue(1));
    }
}
