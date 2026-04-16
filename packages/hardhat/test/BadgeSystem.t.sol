// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { BadgeSystem } from "../contracts/BadgeSystem.sol";

/// @title BadgeSystemTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas del nuevo modelo: SubjectBadge -> Assignment -> PrizeCategory.
contract BadgeSystemTest is Test {

    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    BadgeSystem badgeSystem;

    address professor;
    address professor2;
    address student;
    address student2;
    address student3;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        badgeSystem = new BadgeSystem(address(campusRoles), "https://badges.ucm.es/");

        professor = makeAddr("professor");
        professor2 = makeAddr("professor2");
        student = makeAddr("student");
        student2 = makeAddr("student2");
        student3 = makeAddr("student3");

        campusRoles.registerUser(professor, "Prof", campusRoles.PROFESSOR_ROLE());
        campusRoles.registerUser(professor2, "Prof2", campusRoles.PROFESSOR_ROLE());
        campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());
        campusRoles.registerUser(student2, "Student2", campusRoles.STUDENT_ROLE());
        campusRoles.registerUser(student3, "Student3", campusRoles.STUDENT_ROLE());
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    function _winners(address a) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = a;
    }

    function _winners(address a, address b) internal pure returns (address[] memory list) {
        list = new address[](2);
        list[0] = a;
        list[1] = b;
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_CreateAwardAndRedeemReward() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();              // subjectBadgeId = 1
        badgeSystem.createAssignment(1);                // assignmentId = 1
        badgeSystem.addPrizeCategory(1, 5, 3);          // prizeCategoryId = 1: 5 insignias, max 3 ganadores
        badgeSystem.createReward(1, 3, 10);             // rewardId = 1: cuesta 3 insignias, supply 10
        badgeSystem.awardPrize(1, _winners(student));   // student gana 5 insignias
        vm.stopPrank();

        assertEq(badgeSystem.getBadgeBalance(student, 1), 5);

        vm.prank(student);
        badgeSystem.redeemReward(1);

        assertEq(badgeSystem.getBadgeBalance(student, 1), 2);
        BadgeSystem.Reward memory reward = badgeSystem.getReward(1);
        assertEq(reward.supply, 9);
    }

    function test_RevertWhenStudentCreatesSubjectBadge() public {
        vm.prank(student);
        vm.expectRevert(BadgeSystem.NotProfessor.selector);
        badgeSystem.createSubjectBadge();
    }

    function test_RevertSoulboundTransferBlocked() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 1, 5);
        badgeSystem.awardPrize(1, _winners(student));
        vm.stopPrank();

        vm.prank(student);
        vm.expectRevert(BadgeSystem.SoulboundTransferBlocked.selector);
        badgeSystem.safeTransferFrom(student, student2, 1, 1, "");
    }

    function test_AssignmentLifecycle() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 5, 5);
        badgeSystem.closeAssignmentForReview(1);
        vm.stopPrank();

        BadgeSystem.Assignment memory a = badgeSystem.getAssignment(1);
        assertEq(uint256(a.status), uint256(BadgeSystem.AssignmentStatus.Reviewing));

        vm.prank(professor);
        badgeSystem.closeAssignment(1);

        a = badgeSystem.getAssignment(1);
        assertEq(uint256(a.status), uint256(BadgeSystem.AssignmentStatus.Closed));
    }

    function test_RevertAddPrizeWhenAssignmentNotOpen() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.closeAssignmentForReview(1);
        vm.expectRevert(
            abi.encodeWithSelector(
                BadgeSystem.InvalidAssignmentStatus.selector,
                1,
                BadgeSystem.AssignmentStatus.Reviewing
            )
        );
        badgeSystem.addPrizeCategory(1, 5, 5);
        vm.stopPrank();
    }

    function test_RevertAwardPrizeWhenAssignmentClosed() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 5, 5);
        badgeSystem.closeAssignment(1);
        vm.expectRevert(
            abi.encodeWithSelector(
                BadgeSystem.InvalidAssignmentStatus.selector,
                1,
                BadgeSystem.AssignmentStatus.Closed
            )
        );
        badgeSystem.awardPrize(1, _winners(student));
        vm.stopPrank();
    }

    function test_RevertMaxWinnersReached() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 5, 1);  // solo 1 ganador
        badgeSystem.awardPrize(1, _winners(student));
        vm.expectRevert(abi.encodeWithSelector(BadgeSystem.MaxWinnersReached.selector, 1));
        badgeSystem.awardPrize(1, _winners(student2));
        vm.stopPrank();
    }

    function test_AwardPrizeMultipleWinners() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 7, 2);
        badgeSystem.awardPrize(1, _winners(student, student2));
        vm.stopPrank();

        assertEq(badgeSystem.getBadgeBalance(student, 1), 7);
        assertEq(badgeSystem.getBadgeBalance(student2, 1), 7);

        BadgeSystem.PrizeCategory memory p = badgeSystem.getPrizeCategory(1);
        assertEq(p.currentWinners, 2);
    }

    function test_RevertAlreadyAwardedPrize() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 5, 5);
        badgeSystem.awardPrize(1, _winners(student));
        vm.expectRevert(abi.encodeWithSelector(BadgeSystem.AlreadyAwardedPrize.selector, student, 1));
        badgeSystem.awardPrize(1, _winners(student));
        vm.stopPrank();
    }

    function test_DeactivateReward() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createReward(1, 3, 10);
        badgeSystem.deactivateReward(1);
        vm.stopPrank();

        BadgeSystem.Reward memory reward = badgeSystem.getReward(1);
        assertFalse(reward.active);
    }

    function test_RevertCreateRewardZeroCost() public {
        vm.prank(professor);
        badgeSystem.createSubjectBadge();

        vm.prank(professor);
        vm.expectRevert(BadgeSystem.ZeroCost.selector);
        badgeSystem.createReward(1, 0, 10);
    }

    function test_RevertAddPrizeZeroBadgeReward() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        vm.expectRevert(BadgeSystem.ZeroBadgeReward.selector);
        badgeSystem.addPrizeCategory(1, 0, 1);
        vm.stopPrank();
    }

    function test_RevertAwardPrizeNotStudent() public {
        address outsider = makeAddr("outsider");

        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 5, 5);
        vm.expectRevert(BadgeSystem.NotStudent.selector);
        badgeSystem.awardPrize(1, _winners(outsider));
        vm.stopPrank();
    }

    function test_CancelUseRequest() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 5, 5);
        badgeSystem.createReward(1, 3, 10);
        badgeSystem.awardPrize(1, _winners(student));
        vm.stopPrank();

        vm.prank(student);
        badgeSystem.redeemReward(1);

        vm.prank(student);
        badgeSystem.requestUseReward(1);

        vm.prank(student);
        badgeSystem.cancelUseRequest(1);

        BadgeSystem.UseRequest memory req = badgeSystem.getUseRequest(1);
        assertEq(uint256(req.status), uint256(BadgeSystem.UseRequestStatus.Cancelled));
    }

    function test_RejectUseRequest() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 5, 5);
        badgeSystem.createReward(1, 3, 10);
        badgeSystem.awardPrize(1, _winners(student));
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
        vm.prank(professor);
        badgeSystem.createSubjectBadge();

        badgeSystem.pause();

        vm.prank(professor);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        badgeSystem.createSubjectBadge();

        badgeSystem.unpause();

        vm.prank(professor);
        badgeSystem.createSubjectBadge();
    }

    function test_SafeBatchTransferFromBlocked() public {
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();
        badgeSystem.createAssignment(1);
        badgeSystem.addPrizeCategory(1, 1, 5);
        badgeSystem.awardPrize(1, _winners(student));
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
