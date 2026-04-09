// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";
import { LibraryManager } from "../contracts/LibraryManager.sol";

/// @title LibraryManagerTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas de comportamiento y reverts para el ciclo de vida de prestamos en LibraryManager.
/// @dev Cubre solicitud, aprobacion, devolucion, devolucion forzada y validaciones de disponibilidad.
contract LibraryManagerTest is Test {
    
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    LibraryToken libraryToken;
    LibraryManager libraryManager;

    address librarian;
    address student;
    address outsider;

    // ── Setup ────────────────────────────────────────────────────────────

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

    // ── Tests ────────────────────────────────────────────────────────────

    function test_RequestApproveAndConfirmReturn() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        // Deposit locked on request
        assertEq(libraryToken.balanceOf(student), 9);

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
        assertEq(libraryToken.balanceOf(student), 9);

        vm.prank(librarian);
        libraryManager.approveLoan(1);

        vm.warp(block.timestamp + 22 days);

        vm.prank(librarian);
        libraryManager.forceReturn(1);

        assertEq(libraryManager.balanceOf(student, 1), 0);
        // Deposit NOT returned (penalty)
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

    function test_RejectLoanReturnsDeposit() public {
        vm.prank(student);
        libraryManager.requestLoan(1);
        assertEq(libraryToken.balanceOf(student), 9);

        vm.prank(librarian);
        libraryManager.rejectLoan(1, "Not available");

        LibraryManager.Loan memory loan = libraryManager.getLoanInfo(1);
        assertEq(uint256(loan.status), uint256(LibraryManager.LoanStatus.Rejected));
        // Deposit returned
        assertEq(libraryToken.balanceOf(student), 10);
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

    function test_CancelLoanRequestReturnsDeposit() public {
        vm.prank(student);
        libraryManager.requestLoan(1);
        assertEq(libraryToken.balanceOf(student), 9);

        vm.prank(student);
        libraryManager.cancelLoanRequest(1);

        LibraryManager.Loan memory loan = libraryManager.getLoanInfo(1);
        // cancelLoanRequest deja el estado en Rejected (reutilizado para cancelaciones).
        assertEq(uint256(loan.status), uint256(LibraryManager.LoanStatus.Rejected));
        // Deposit returned
        assertEq(libraryToken.balanceOf(student), 10);
    }

    function test_PauseAndUnpause() public {
        // Admin pausa el contrato.
        libraryManager.pause();

        // Anadir libro revierte mientras esta pausado.
        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        libraryManager.addBook(1);

        // Admin reanuda el contrato.
        libraryManager.unpause();

        // Ahora vuelve a funcionar.
        vm.prank(librarian);
        libraryManager.addBook(1);
    }

    function test_IsOverdue() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.approveLoan(1);

        assertFalse(libraryManager.isOverdue(1));

        // Avanzar mas alla de la fecha limite (DEFAULT_LOAN_DURATION = 21 days).
        vm.warp(block.timestamp + 22 days);

        assertTrue(libraryManager.isOverdue(1));
    }

    function test_RevertRequestLoanAlreadyPending() public {
        vm.prank(student);
        libraryManager.requestLoan(1);

        // Segunda solicitud del mismo libro mientras la primera esta pendiente
        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.AlreadyBorrowingBook.selector, student, 1));
        libraryManager.requestLoan(1);
    }

    function test_RevertRequestLoanInsufficientDeposit() public {
        // Quemar todos los tokens del estudiante
        libraryToken.burn(student, 10);
        assertEq(libraryToken.balanceOf(student), 0);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(LibraryManager.InsufficientDeposit.selector, student));
        libraryManager.requestLoan(1);
    }
}
