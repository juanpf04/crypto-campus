// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { CampusTestBase } from "./helpers/CampusTestBase.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";
import { ShopToken } from "../contracts/ShopToken.sol";
import { Printer } from "../contracts/Printer.sol";
import { LibraryManager } from "../contracts/LibraryManager.sol";
import { BadgeSystem } from "../contracts/BadgeSystem.sol";
import { CampusShop } from "../contracts/CampusShop.sol";

/// @title IntegrationCrossTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas que cruzan multiples modulos a la vez:
///         flujo completo end-to-end y revocacion de roles.
contract IntegrationCrossTest is CampusTestBase {
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    LibraryToken libraryToken;
    ShopToken shopToken;
    Printer printer;
    LibraryManager libraryManager;
    BadgeSystem badgeSystem;
    CampusShop campusShop;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));
        shopToken = new ShopToken(address(campusRoles));
        printer = new Printer(address(campusRoles));
        libraryManager = new LibraryManager(address(campusRoles), address(libraryToken), "https://library.ucm.es/");
        badgeSystem = new BadgeSystem(address(campusRoles), "https://badges.ucm.es/");
        campusShop = new CampusShop(address(campusRoles), address(shopToken), "https://shop.ucm.es/");

        _initAndRegisterStandardUsers(campusRoles);

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
        badgeSystem.createSubjectBadge();           // subjectBadgeId = 1
        badgeSystem.createAssignment(1);             // assignmentId = 1
        badgeSystem.addPrizeCategory(1, 3, 5);       // prizeCategoryId = 1: 3 insignias, max 5
        badgeSystem.createReward(1, 2, 10);          // rewardId = 1
        vm.stopPrank();

        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.confirmPickup(1);

        printer.print(student1, 15);

        vm.prank(student2);
        campusShop.purchase(1);

        vm.prank(professor);
        badgeSystem.awardPrize(1, _arr(student1, student2));

        vm.prank(student1);
        badgeSystem.redeemReward(1);

        assertEq(libraryManager.balanceOf(student1, 1), 1);
        assertEq(libraryToken.balanceOf(student1), 9);
        assertEq(printer.getCredits(student1), 185);
        assertEq(badgeSystem.getBadgeBalance(student1, 1), 1);
        assertEq(shopToken.balanceOf(student2), 70);
        assertEq(campusShop.balanceOf(student2, 1), 1);
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

    // Nota: la prueba de pausado entre contratos se cubre en Integration.test.ts
    // porque Hardhat EDR tiene particularidades con el pausado de CampusRoles.
}
