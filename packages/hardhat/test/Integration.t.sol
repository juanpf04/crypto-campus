// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";
import { ShopToken } from "../contracts/ShopToken.sol";
import { Printer } from "../contracts/Printer.sol";
import { LibraryManager } from "../contracts/LibraryManager.sol";
import { BadgeSystem } from "../contracts/BadgeSystem.sol";
import { CampusShop } from "../contracts/CampusShop.sol";

/// @title IntegrationTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas extremo a extremo de comportamiento entre contratos principales de CryptoCampus.
/// @dev Valida flujos cruzados de roles, prestamos, insignias, impresion y tienda.
contract IntegrationTest is Test {
    
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    LibraryToken libraryToken;
    ShopToken shopToken;
    Printer printer;
    LibraryManager libraryManager;
    BadgeSystem badgeSystem;
    CampusShop campusShop;

    address librarian;
    address professor;
    address student1;
    address student2;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));
        shopToken = new ShopToken(address(campusRoles));
        printer = new Printer(address(campusRoles));
        libraryManager = new LibraryManager(address(campusRoles), address(libraryToken), "https://library.ucm.es/");
        badgeSystem = new BadgeSystem(address(campusRoles), "https://badges.ucm.es/");
        campusShop = new CampusShop(address(campusRoles), address(shopToken), "https://shop.ucm.es/");

        librarian = makeAddr("librarian");
        professor = makeAddr("professor");
        student1 = makeAddr("student1");
        student2 = makeAddr("student2");

        campusRoles.registerUser(librarian, "Librarian", campusRoles.LIBRARIAN_ROLE());
        campusRoles.registerUser(professor, "Professor", campusRoles.PROFESSOR_ROLE());
        campusRoles.registerUser(student1, "Student1", campusRoles.STUDENT_ROLE());
        campusRoles.registerUser(student2, "Student2", campusRoles.STUDENT_ROLE());

        libraryToken.setTrustedSpender(address(libraryManager));
        shopToken.setTrustedSpender(address(campusShop));

        libraryToken.mint(student1, 10);
        libraryToken.mint(student2, 10);
        shopToken.mint(student1, 200);
        shopToken.mint(student2, 150);
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_CrossContractFlow() public {
        vm.prank(librarian);
        libraryManager.addBook(3);

        campusShop.addProduct(80, 10);

        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 3);
        badgeSystem.createReward(1, 2, 10);
        vm.stopPrank();

        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        printer.print(student1, 15);

        vm.prank(student2);
        campusShop.purchase(1);

        vm.prank(professor);
        badgeSystem.awardBadge(1, student1);
        vm.prank(professor);
        badgeSystem.awardBadge(1, student2);

        vm.prank(student1);
        badgeSystem.redeemReward(1);

        assertEq(libraryManager.balanceOf(student1, 1), 1);
        assertEq(libraryToken.balanceOf(student1), 9);
        assertEq(printer.getCredits(student1), 185);
        assertEq(badgeSystem.getBadgeBalance(student1, 1), 1);
        assertEq(shopToken.balanceOf(student2), 70);
        assertEq(campusShop.balanceOf(student2, 1), 1);
    }

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

    function test_FullShopReturnFlow() public {
        // Admin anade un producto (price=80, existencias=5).
        campusShop.addProduct(80, 5);

        // student1 compra el producto.
        vm.prank(student1);
        campusShop.purchase(1);

        // Verificar compra: NFT recibo minteado, tokens descontados y existencias reducidas.
        assertEq(campusShop.balanceOf(student1, 1), 1);
        assertEq(shopToken.balanceOf(student1), 120);

        // Admin marca como entregado.
        campusShop.markDelivered(1);

        // student1 solicita devolucion.
        vm.prank(student1);
        campusShop.requestReturn(1);

        // Verificar reembolso, recibo quemado, recibo de devolucion minteado y existencias restauradas.
        assertEq(shopToken.balanceOf(student1), 200);
        assertEq(campusShop.balanceOf(student1, 1), 0);

        uint256 returnTokenId = campusShop.getReturnReceiptTokenId(1);
        assertEq(campusShop.balanceOf(student1, returnTokenId), 1);

        (, uint256 stock, , ) = campusShop.getProduct(1);
        assertEq(stock, 5);
    }

    function test_FullBadgeUseRequestFlow() public {
        // El profesor crea tipo de insignia, tarea y recompensa.
        vm.startPrank(professor);
        badgeSystem.createBadgeType(); // badgeTypeId = 1
        badgeSystem.createTask(1, 3); // taskId = 1, otorga 3 insignias
        badgeSystem.createReward(1, 2, 10); // rewardId = 1, cuesta 2 insignias
        vm.stopPrank();

        // El profesor otorga insignias a student1.
        vm.prank(professor);
        badgeSystem.awardBadge(1, student1);

        // student1 canjea recompensa (quema 2 insignias y recibe token de recompensa).
        vm.prank(student1);
        badgeSystem.redeemReward(1);

        uint256 rewardTokenId = badgeSystem.getRewardTokenId(1);
        assertEq(badgeSystem.balanceOf(student1, rewardTokenId), 1);

        // student1 solicita usar la recompensa.
        vm.prank(student1);
        badgeSystem.requestUseReward(1);

        // El profesor aprueba la solicitud de uso (quema el token de recompensa).
        vm.prank(professor);
        badgeSystem.approveUseRequest(1);

        // Verificar token de recompensa quemado.
        assertEq(badgeSystem.balanceOf(student1, rewardTokenId), 0);
    }

    function test_RoleRemovalBlocksAccess() public {
        // student1 puede imprimir normalmente.
        printer.print(student1, 10);
        assertEq(printer.getCredits(student1), int256(190));

        // Admin elimina a student1.
        campusRoles.removeUser(student1);

        // Imprimir para usuario eliminado debe revertir con NotRegistered.
        vm.expectRevert(abi.encodeWithSelector(Printer.NotRegistered.selector, student1));
        printer.print(student1, 5);
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

    // Nota: la prueba de pausado entre contratos se cubre en Integration.test.ts
    // porque Hardhat EDR tiene particularidades con el pausado de CampusRoles.

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
