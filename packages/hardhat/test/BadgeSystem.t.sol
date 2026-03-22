// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { BadgeSystem } from "../contracts/BadgeSystem.sol";

contract BadgeSystemTest is Test {
    CampusRoles campusRoles;
    BadgeSystem badgeSystem;

    address professor;
    address professor2;
    address student;
    address student2;

    function setUp() public {
        campusRoles = new CampusRoles();
        badgeSystem = new BadgeSystem(address(campusRoles), "https://badges.ucm.es/");

        professor = makeAddr("professor");
        professor2 = makeAddr("professor2");
        student = makeAddr("student");
        student2 = makeAddr("student2");

        campusRoles.registerUser(professor, "Prof", campusRoles.PROFESSOR_ROLE());
        campusRoles.registerUser(professor2, "Prof2", campusRoles.PROFESSOR_ROLE());
        campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());
        campusRoles.registerUser(student2, "Student2", campusRoles.STUDENT_ROLE());
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
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 1);
        badgeSystem.awardBadge(1, student);
        vm.stopPrank();

        vm.prank(student);
        vm.expectRevert(BadgeSystem.SoulboundTransferBlocked.selector);
        badgeSystem.safeTransferFrom(student, student2, 1, 1, "");
    }

    function test_DeactivateTask() public {
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 5);
        badgeSystem.deactivateTask(1);
        vm.stopPrank();

        BadgeSystem.Task memory task = badgeSystem.getTask(1);
        assertFalse(task.active);
    }

    function test_RevertDeactivateTaskNotOwner() public {
        vm.prank(professor);
        badgeSystem.createBadgeType();

        vm.prank(professor);
        badgeSystem.createTask(1, 5);

        vm.prank(professor2);
        vm.expectRevert(abi.encodeWithSelector(BadgeSystem.NotTaskOwner.selector, 1, professor2));
        badgeSystem.deactivateTask(1);
    }

    function test_DeactivateReward() public {
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createReward(1, 3, 10);
        badgeSystem.deactivateReward(1);
        vm.stopPrank();

        BadgeSystem.Reward memory reward = badgeSystem.getReward(1);
        assertFalse(reward.active);
    }

    function test_RevertDeactivateRewardNotOwner() public {
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createReward(1, 3, 10);
        vm.stopPrank();

        vm.prank(professor2);
        vm.expectRevert(abi.encodeWithSelector(BadgeSystem.NotRewardOwner.selector, 1, professor2));
        badgeSystem.deactivateReward(1);
    }

    function test_RevertCreateTaskZeroRewardAmount() public {
        vm.prank(professor);
        badgeSystem.createBadgeType();

        vm.prank(professor);
        vm.expectRevert(BadgeSystem.ZeroRewardAmount.selector);
        badgeSystem.createTask(1, 0);
    }

    function test_RevertCreateTaskBadgeTypeNotFound() public {
        vm.prank(professor);
        vm.expectRevert(abi.encodeWithSelector(BadgeSystem.BadgeTypeNotFound.selector, 999));
        badgeSystem.createTask(999, 5);
    }

    function test_RevertCreateRewardZeroCost() public {
        vm.prank(professor);
        badgeSystem.createBadgeType();

        vm.prank(professor);
        vm.expectRevert(BadgeSystem.ZeroCost.selector);
        badgeSystem.createReward(1, 0, 10);
    }

    function test_RevertAwardBadgeTaskNotActive() public {
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 5);
        badgeSystem.deactivateTask(1);
        vm.expectRevert(abi.encodeWithSelector(BadgeSystem.TaskNotActive.selector, 1));
        badgeSystem.awardBadge(1, student);
        vm.stopPrank();
    }

    function test_RevertAwardBadgeNotStudent() public {
        address outsider = makeAddr("outsider");

        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 5);
        vm.expectRevert(BadgeSystem.NotStudent.selector);
        badgeSystem.awardBadge(1, outsider);
        vm.stopPrank();
    }

    function test_RevertRedeemRewardInactive() public {
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 5);
        badgeSystem.createReward(1, 3, 10);
        badgeSystem.awardBadge(1, student);
        badgeSystem.deactivateReward(1);
        vm.stopPrank();

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(BadgeSystem.RewardInactive.selector, 1));
        badgeSystem.redeemReward(1);
    }

    function test_RevertRedeemRewardOutOfSupply() public {
        // Create badge type, task with rewardAmount=3, reward with cost=3 and supply=1
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 3);  // task 1: awards 3 badges
        badgeSystem.createTask(1, 3);  // task 2: awards 3 badges
        badgeSystem.createReward(1, 3, 1); // reward 1: costs 3 badges, supply=1
        badgeSystem.awardBadge(1, student);  // student gets 3 badges from task 1
        badgeSystem.awardBadge(2, student2); // student2 gets 3 badges from task 2
        vm.stopPrank();

        // First redeem succeeds (supply goes from 1 to 0)
        vm.prank(student);
        badgeSystem.redeemReward(1);

        // Second redeem fails (supply is 0)
        vm.prank(student2);
        vm.expectRevert(abi.encodeWithSelector(BadgeSystem.RewardOutOfSupply.selector, 1));
        badgeSystem.redeemReward(1);
    }

    function test_CancelUseRequest() public {
        // Setup: create badge, task, reward, award, redeem to get reward token
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 5);
        badgeSystem.createReward(1, 3, 10);
        badgeSystem.awardBadge(1, student);
        vm.stopPrank();

        vm.prank(student);
        badgeSystem.redeemReward(1);

        // Request use then cancel
        vm.prank(student);
        badgeSystem.requestUseReward(1);

        vm.prank(student);
        badgeSystem.cancelUseRequest(1);

        BadgeSystem.UseRequest memory req = badgeSystem.getUseRequest(1);
        assertEq(uint256(req.status), uint256(BadgeSystem.UseRequestStatus.Cancelled));
    }

    function test_RejectUseRequest() public {
        // Setup: create badge, task, reward, award, redeem to get reward token
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 5);
        badgeSystem.createReward(1, 3, 10);
        badgeSystem.awardBadge(1, student);
        vm.stopPrank();

        vm.prank(student);
        badgeSystem.redeemReward(1);

        vm.prank(student);
        badgeSystem.requestUseReward(1);

        vm.prank(professor);
        badgeSystem.rejectUseRequest(1);

        BadgeSystem.UseRequest memory req = badgeSystem.getUseRequest(1);
        assertEq(uint256(req.status), uint256(BadgeSystem.UseRequestStatus.Rejected));
    }

    function test_PauseAndUnpause() public {
        // Setup: professor creates badge type before pausing
        vm.prank(professor);
        badgeSystem.createBadgeType();

        // Admin pauses the contract
        badgeSystem.pause();

        // Creating a badge type reverts while paused
        vm.prank(professor);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        badgeSystem.createBadgeType();

        // Admin unpauses
        badgeSystem.unpause();

        // Now it works again
        vm.prank(professor);
        badgeSystem.createBadgeType();
    }

    function test_SafeBatchTransferFromBlocked() public {
        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 1);
        badgeSystem.awardBadge(1, student);
        vm.stopPrank();

        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        vm.prank(student);
        vm.expectRevert(BadgeSystem.SoulboundTransferBlocked.selector);
        badgeSystem.safeBatchTransferFrom(student, student2, ids, amounts, "");
    }
}
