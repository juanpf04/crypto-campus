// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { CampusTestBase } from "./helpers/CampusTestBase.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { BadgeSystem } from "../contracts/BadgeSystem.sol";

/// @title IntegrationBadgesTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas end-to-end del modulo Insignias (BadgeSystem).
contract IntegrationBadgesTest is CampusTestBase {
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    BadgeSystem badgeSystem;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        badgeSystem = new BadgeSystem(address(campusRoles), "https://badges.ucm.es/");

        _initAndRegisterStandardUsers(campusRoles);
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_FullBadgeUseRequestFlow() public {
        // El profesor crea insignia de asignatura, tarea con premio y recompensa.
        vm.startPrank(professor);
        badgeSystem.createSubjectBadge();           // subjectBadgeId = 1
        badgeSystem.createAssignment(1);             // assignmentId = 1
        badgeSystem.addPrizeCategory(1, 3, 5);       // prizeCategoryId = 1
        badgeSystem.createReward(1, 2, 10);          // rewardId = 1
        vm.stopPrank();

        // El profesor otorga el premio a student1.
        vm.prank(professor);
        badgeSystem.awardPrize(1, _arr(student1));

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
}
