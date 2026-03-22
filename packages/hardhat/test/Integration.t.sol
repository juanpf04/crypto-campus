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

contract IntegrationTest is Test {
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
        libraryManager.approveLoan(1);

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
}
