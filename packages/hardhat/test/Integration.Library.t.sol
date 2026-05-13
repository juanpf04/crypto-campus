// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { CampusTestBase } from "./helpers/CampusTestBase.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";
import { LibraryManager } from "../contracts/LibraryManager.sol";

/// @title IntegrationLibraryTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas end-to-end del modulo Biblioteca (LibraryToken + LibraryManager).
contract IntegrationLibraryTest is CampusTestBase {
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    LibraryToken libraryToken;
    LibraryManager libraryManager;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));
        libraryManager = new LibraryManager(address(campusRoles), address(libraryToken), "https://library.ucm.es/");

        _initAndRegisterStandardUsers(campusRoles);

        libraryToken.setTrustedSpender(address(libraryManager));

        libraryToken.mint(student1, 10);
        libraryToken.mint(student2, 10);
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_FullLibraryReturnFlow() public {
        // El bibliotecario anade un libro con 2 copias.
        vm.prank(librarian);
        libraryManager.addBook(2);

        // student1 solicita y obtiene aprobacion del prestamo.
        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        // Verificar que student1 tiene el NFT del libro y se bloqueo el deposito.
        assertEq(libraryManager.balanceOf(student1, 1), 1);
        assertEq(libraryToken.balanceOf(student1), 9);

        // El bibliotecario confirma la devolucion.
        vm.prank(librarian);
        libraryManager.confirmReturn(1);

        // Verificar que el NFT vuelve al contrato, se devuelve deposito y el prestamo finaliza.
        assertEq(libraryManager.balanceOf(student1, 1), 0);
        assertEq(libraryToken.balanceOf(student1), 10);

        LibraryManager.Loan memory loan = libraryManager.getLoanInfo(1);
        assertTrue(loan.status == LibraryManager.LoanStatus.Returned);
    }

    function test_OverdueForceReturnPenalty() public {
        // El bibliotecario anade un libro.
        vm.prank(librarian);
        libraryManager.addBook(2);

        // student1 solicita y obtiene prestamo aprobado.
        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        // El deposito fue retenido.
        assertEq(libraryToken.balanceOf(student1), 9);

        // Avanzar 22 dias (supera la duracion por defecto de 21 dias).
        vm.warp(block.timestamp + 22 days);

        // El bibliotecario fuerza la devolucion.
        vm.prank(librarian);
        libraryManager.forceReturn(1);

        // NFT del libro devuelto al contrato.
        assertEq(libraryManager.balanceOf(student1, 1), 0);

        // Deposito NO devuelto (penalizacion): student mantiene 9 tokens.
        assertEq(libraryToken.balanceOf(student1), 9);
    }

    function test_MultipleStudentsIndependentState() public {
        // El bibliotecario anade un libro con 2 copias.
        vm.prank(librarian);
        libraryManager.addBook(2);

        // Ambos estudiantes piden prestado el mismo libro.
        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(student2);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.confirmPickup(1); // prestamo de student1
        vm.prank(librarian);
        libraryManager.confirmPickup(2); // prestamo de student2

        // Ambos tienen NFTs del libro.
        assertEq(libraryManager.balanceOf(student1, 1), 1);
        assertEq(libraryManager.balanceOf(student2, 1), 1);

        // student1 devuelve.
        vm.prank(librarian);
        libraryManager.confirmReturn(1);

        // student1 ya no tiene el libro.
        assertEq(libraryManager.balanceOf(student1, 1), 0);

        // student2 mantiene su prestamo activo.
        assertEq(libraryManager.balanceOf(student2, 1), 1);

        LibraryManager.Loan memory loan2 = libraryManager.getLoanInfo(2);
        assertTrue(loan2.status == LibraryManager.LoanStatus.PickedUp);
    }
}
