// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { CampusRoles } from "../contracts/CampusRoles.sol";
import { Printer } from "../contracts/Printer.sol";

/// @notice Basic behavioral tests for Printer.
contract PrinterTest is Test {
    CampusRoles campusRoles;
    Printer printer;

    address student;
    address outsider;

    function setUp() public {
        // Deploy contracts and register a baseline student for test scenarios.
        campusRoles = new CampusRoles();
        printer = new Printer(address(campusRoles));

        student = makeAddr("student");
        outsider = makeAddr("outsider");

        campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());
    }

    function test_InitialCreditsForRegisteredStudent() public view {
        // Assert default credits for a registered student.
        assertEq(printer.getCredits(student), int256(200));
    }

    function test_GetCreditsReturnsMinusOneForNonStudent() public view {
        // Non-student addresses should return sentinel value -1.
        assertEq(printer.getCredits(outsider), int256(-1));
    }

    function test_SetCreditsUpdatesStudentBalanceAndEmitsEvent() public {
        // Expect event before state-changing call.
        vm.expectEmit();
        emit Printer.CreditsSet(student, 120);

        printer.setCredits(student, 120);

        assertEq(printer.getCredits(student), int256(120));
    }

    function test_PrintConsumesCreditsAndEmitsEvent() public {
        // Arrange explicit credits to verify deterministic remaining balance.
        printer.setCredits(student, 50);

        vm.expectEmit();
        emit Printer.PrintJobExecuted(student, 15, 35);

        printer.print(student, 15);

        assertEq(printer.getCredits(student), int256(35));
    }

    function test_RevertWhenPrintExceedsAvailableCredits() public {
        // Printing more pages than available credits must revert.
        printer.setCredits(student, 10);

        vm.expectRevert(abi.encodeWithSelector(Printer.InsufficientCredits.selector, 10, 20));
        printer.print(student, 20);
    }

    function test_RevertWhenNonAdminSetsCredits() public {
        // Any non-admin caller should be rejected.
        vm.prank(student);
        vm.expectRevert(Printer.NotAdmin.selector);
        printer.setCredits(student, 100);
    }
}
