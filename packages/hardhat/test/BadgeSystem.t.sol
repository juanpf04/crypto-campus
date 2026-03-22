// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { BadgeSystem } from "../contracts/BadgeSystem.sol";

contract BadgeSystemTest is Test {
    CampusRoles campusRoles;
    BadgeSystem badgeSystem;

    address professor;
    address student;

    function setUp() public {
        campusRoles = new CampusRoles();
        badgeSystem = new BadgeSystem(address(campusRoles), "https://badges.ucm.es/");

        professor = makeAddr("professor");
        student = makeAddr("student");

        campusRoles.registerUser(professor, "Prof", campusRoles.PROFESSOR_ROLE());
        campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());
    }

    function test_CreateAwardAndRedeemReward() public {
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 5);
        badgeSystem.createReward(1, 3, 10);
        badgeSystem.awardBadge(1, student);
        vm.stopPrank();

        assertEq(badgeSystem.getBadgeBalance(student, 1), 5);

        vm.prank(student);
        badgeSystem.redeemReward(1);

        assertEq(badgeSystem.getBadgeBalance(student, 1), 2);
        BadgeSystem.Reward memory reward = badgeSystem.getReward(1);
        assertEq(reward.supply, 9);
    }

    function test_RevertWhenStudentCreatesBadgeType() public {
        vm.prank(student);
        vm.expectRevert(BadgeSystem.NotProfessor.selector);
        badgeSystem.createBadgeType();
    }

    function test_RevertSoulboundTransferBlocked() public {
        address student2 = makeAddr("student2");
        campusRoles.registerUser(student2, "Student2", campusRoles.STUDENT_ROLE());

        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 1);
        badgeSystem.awardBadge(1, student);
        vm.stopPrank();

        vm.prank(student);
        vm.expectRevert(BadgeSystem.SoulboundTransferBlocked.selector);
        badgeSystem.safeTransferFrom(student, student2, 1, 1, "");
    }
}
