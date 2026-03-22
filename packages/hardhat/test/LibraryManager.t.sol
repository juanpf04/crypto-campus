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

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));
        libraryManager = new LibraryManager(address(campusRoles), address(libraryToken), "https://library.ucm.es/");

        librarian = makeAddr("librarian");
        student = makeAddr("student");

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
}
