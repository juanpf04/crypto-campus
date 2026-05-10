import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, parseAbi } from "viem";

describe("BadgeSystem", async function () {
    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const soulboundAbi = parseAbi([
        "function safeTransferFrom(address from,address to,uint256 id,uint256 value,bytes data)",
        "function setApprovalForAll(address operator,bool approved)",
    ]);

    async function deploySystem() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const badgeSystem = await viem.deployContract("BadgeSystem", [
            campusRoles.address,
            "https://badges.ucm.es/",
        ]);

        const [admin, professor1, professor2, student1, student2, outsider] = await viem.getWalletClients();
        const professorRole = await campusRoles.read.PROFESSOR_ROLE();
        const studentRole = await campusRoles.read.STUDENT_ROLE();

        await campusRoles.write.registerUser([professor1.account.address, "Prof1", professorRole]);
        await campusRoles.write.registerUser([professor2.account.address, "Prof2", professorRole]);
        await campusRoles.write.registerUser([student1.account.address, "Student1", studentRole]);
        await campusRoles.write.registerUser([student2.account.address, "Student2", studentRole]);

        return { badgeSystem, campusRoles, admin, professor1, professor2, student1, student2, outsider };
    }

    describe("Deployment", function () {
        it("Should set references and counters", async function () {
            const { badgeSystem, campusRoles } = await deploySystem();
            assert.equal(getAddress(await badgeSystem.read.campusRoles()), getAddress(campusRoles.address));
            assert.equal(await badgeSystem.read.nextSubjectBadgeId(), 1n);
            assert.equal(await badgeSystem.read.nextAssignmentId(), 1n);
            assert.equal(await badgeSystem.read.nextPrizeCategoryId(), 1n);
            assert.equal(await badgeSystem.read.nextRewardId(), 1n);
            assert.equal(await badgeSystem.read.nextRedemptionId(), 1n);
        });
    });

    describe("Subject badges, assignments and prizes", function () {
        it("Should create subject badge, assignment and prize category", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            const badge = await badgeSystem.read.getSubjectBadge([1n]);
            assert.equal(getAddress(badge.professor), getAddress(professor1.account.address));
            assert.equal(badge.exists, true);

            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            const assignment = await badgeSystem.read.getAssignment([1n]);
            assert.equal(assignment.subjectBadgeId, 1n);
            assert.equal(assignment.status, 1); // Open

            await badgeSystem.write.addPrizeCategory([1n, 5n, 3n], { account: professor1.account });
            const prize = await badgeSystem.read.getPrizeCategory([1n]);
            assert.equal(prize.assignmentId, 1n);
            assert.equal(prize.badgeReward, 5n);
            assert.equal(prize.maxWinners, 3n);
            assert.equal(prize.currentWinners, 0n);
        });

        it("Should enforce ownership and role checks", async function () {
            const { badgeSystem, professor1, professor2, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });

            // Otro profesor no puede crear assignment del subjectBadge ajeno
            await assert.rejects(async () => {
                await badgeSystem.write.createAssignment([1n], { account: professor2.account });
            });

            // Estudiante no puede crear subjectBadge
            await assert.rejects(async () => {
                await badgeSystem.write.createSubjectBadge({ account: student1.account });
            });
        });
    });

    describe("Award and rewards", function () {
        it("Should award prize and redeem reward", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 5n, 3n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });

            assert.equal(await badgeSystem.read.getBadgeBalance([student1.account.address, 1n]), 5n);

            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            assert.equal(await badgeSystem.read.getBadgeBalance([student1.account.address, 1n]), 2n);
            const reward = await badgeSystem.read.getReward([1n]);
            assert.equal(reward.supply, 9n);
        });

        it("Should award prize to multiple winners in one tx", async function () {
            const { badgeSystem, professor1, student1, student2 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 7n, 3n], { account: professor1.account });
            await badgeSystem.write.awardPrize(
                [1n, [student1.account.address, student2.account.address]],
                { account: professor1.account },
            );

            assert.equal(await badgeSystem.read.getBadgeBalance([student1.account.address, 1n]), 7n);
            assert.equal(await badgeSystem.read.getBadgeBalance([student2.account.address, 1n]), 7n);

            const prize = await badgeSystem.read.getPrizeCategory([1n]);
            assert.equal(prize.currentWinners, 2n);
        });

        it("Should revert on double award and max winners", async function () {
            const { badgeSystem, professor1, student1, student2 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 5n, 1n], { account: professor1.account }); // max 1
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });

            // No se puede otorgar de nuevo al mismo (AlreadyAwardedPrize) ni a otro (MaxWinnersReached)
            await assert.rejects(async () => {
                await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });
            });
            await assert.rejects(async () => {
                await badgeSystem.write.awardPrize([1n, [student2.account.address]], { account: professor1.account });
            });
        });

        it("Should revert when redeeming with insufficient badges", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 2n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });

            await badgeSystem.write.createReward([1n, 10n, 5n], { account: professor1.account });
            await assert.rejects(async () => {
                await badgeSystem.write.redeemReward([1n], { account: student1.account });
            });
        });
    });

    describe("Assignment lifecycle", function () {
        it("Should transition Open -> Reviewing -> Closed", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });

            await badgeSystem.write.closeAssignmentForReview([1n], { account: professor1.account });
            let a = await badgeSystem.read.getAssignment([1n]);
            assert.equal(a.status, 2); // Reviewing

            await badgeSystem.write.closeAssignment([1n], { account: professor1.account });
            a = await badgeSystem.read.getAssignment([1n]);
            assert.equal(a.status, 3); // Closed
        });

        it("Should revert addPrizeCategory when not Open", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.closeAssignmentForReview([1n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.addPrizeCategory([1n, 5n, 5n], { account: professor1.account });
            });
        });

        it("Should revert awardPrize when assignment is Closed", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 5n, 5n], { account: professor1.account });
            await badgeSystem.write.closeAssignment([1n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });
            });
        });
    });

    describe("Reward use flow", function () {
        it("Should create, approve and burn reward token", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 3n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            await badgeSystem.write.requestUseReward([1n], { account: student1.account });
            await badgeSystem.write.approveUseRequest([1n], { account: professor1.account });

            const req = await badgeSystem.read.getUseRequest([1n]);
            assert.equal(req.status, 2); // Approved

            const rewardTokenId = await badgeSystem.read.getRewardTokenId([1n]);
            assert.equal(await badgeSystem.read.balanceOf([student1.account.address, rewardTokenId]), 0n);
        });

        it("Should cancel a pending use request", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 3n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.cancelUseRequest([1n], { account: student1.account });

            const req = await badgeSystem.read.getUseRequest([1n]);
            assert.equal(req.status, 4); // Cancelled
        });

        it("Should reject a pending use request", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 3n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.rejectUseRequest([1n], { account: professor1.account });

            const req = await badgeSystem.read.getUseRequest([1n]);
            assert.equal(req.status, 3); // Rejected
        });
    });

    describe("Reward management", function () {
        it("Should deactivate a reward", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });
            await badgeSystem.write.deactivateReward([1n], { account: professor1.account });

            const reward = await badgeSystem.read.getReward([1n]);
            assert.equal(reward.active, false);
        });

        it("Should reactivate a previously deactivated reward", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });
            await badgeSystem.write.deactivateReward([1n], { account: professor1.account });
            await badgeSystem.write.activateReward([1n], { account: professor1.account });

            const reward = await badgeSystem.read.getReward([1n]);
            assert.equal(reward.active, true);
        });

        it("Should revert activateReward if reward is already active", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });

            // Recién creada, ya está activa — debe revertir.
            await assert.rejects(async () => {
                await badgeSystem.write.activateReward([1n], { account: professor1.account });
            });
        });

        it("Should revert activateReward if caller is not the owner", async function () {
            const { badgeSystem, professor1, professor2 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });
            await badgeSystem.write.deactivateReward([1n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.activateReward([1n], { account: professor2.account });
            });
        });

        it("Should allow redemption after reactivating a reward", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            // badgeReward=3 → student1 recibe 3 insignias, suficientes para pagar cost=3.
            await badgeSystem.write.addPrizeCategory([1n, 3n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });
            await badgeSystem.write.deactivateReward([1n], { account: professor1.account });
            await badgeSystem.write.activateReward([1n], { account: professor1.account });

            // Tras reactivar, redeemReward debe funcionar.
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            const reward = await badgeSystem.read.getReward([1n]);
            assert.equal(reward.supply, 9n);
        });

        it("Should revert createReward with zero cost", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await assert.rejects(async () => {
                await badgeSystem.write.createReward([1n, 0n, 10n], { account: professor1.account });
            });
        });

        it("Should revert createReward with non-existent subjectBadgeId", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.createReward([999n, 3n, 10n], { account: professor1.account });
            });
        });
    });

    describe("Soulbound enforcement", function () {
        it("Should block transfers and approvals", async function () {
            const { badgeSystem, professor1, student1, student2 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 1n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });

            await assert.rejects(async () => {
                await student1.writeContract({
                    address: badgeSystem.address,
                    abi: soulboundAbi,
                    functionName: "safeTransferFrom",
                    args: [student1.account.address, student2.account.address, 1n, 1n, "0x"],
                    account: student1.account,
                });
            });

            await assert.rejects(async () => {
                await student1.writeContract({
                    address: badgeSystem.address,
                    abi: soulboundAbi,
                    functionName: "setApprovalForAll",
                    args: [student2.account.address, true],
                    account: student1.account,
                });
            });

            assert.equal(await badgeSystem.read.isApprovedForAll([student1.account.address, student2.account.address]), false);
        });

        it("Should block batch transfers", async function () {
            const batchAbi = parseAbi([
                "function safeBatchTransferFrom(address from,address to,uint256[] ids,uint256[] values,bytes data)",
            ]);

            const { badgeSystem, professor1, student1, student2 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 1n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });

            await assert.rejects(async () => {
                await student1.writeContract({
                    address: badgeSystem.address,
                    abi: batchAbi,
                    functionName: "safeBatchTransferFrom",
                    args: [student1.account.address, student2.account.address, [1n], [1n], "0x"],
                    account: student1.account,
                });
            });
        });
    });

    describe("Events", function () {
        it("Should emit SubjectBadgeCreated and AssignmentCreated", async function () {
            const { badgeSystem, professor1 } = await deploySystem();
            const fromBlock = await publicClient.getBlockNumber();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });

            const badgeEvents = await publicClient.getContractEvents({
                address: badgeSystem.address,
                abi: badgeSystem.abi,
                eventName: "SubjectBadgeCreated",
                fromBlock,
                strict: true,
            });
            const assignmentEvents = await publicClient.getContractEvents({
                address: badgeSystem.address,
                abi: badgeSystem.abi,
                eventName: "AssignmentCreated",
                fromBlock,
                strict: true,
            });

            assert.equal(badgeEvents.length, 1);
            assert.equal(assignmentEvents.length, 1);
            assert.equal(assignmentEvents[0].args.assignmentId, 1n);
        });
    });

    describe("Pausable", function () {
        it("Should allow admin to pause", async function () {
            const { badgeSystem } = await deploySystem();

            await badgeSystem.write.pause();
            assert.equal(await badgeSystem.read.paused(), true);
        });

        it("Should revert pause when called by non-admin", async function () {
            const { badgeSystem, outsider } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.pause({ account: outsider.account });
            });
        });

        it("Should revert unpause when called by non-admin", async function () {
            const { badgeSystem, outsider } = await deploySystem();

            await badgeSystem.write.pause();
            await assert.rejects(async () => {
                await badgeSystem.write.unpause({ account: outsider.account });
            });
        });

        it("Should revert createSubjectBadge when paused", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.pause();

            await assert.rejects(async () => {
                await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            });
        });

        it("Should restore functionality after unpause", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.pause();
            await badgeSystem.write.unpause();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            const badge = await badgeSystem.read.getSubjectBadge([1n]);
            assert.equal(badge.exists, true);
        });
    });

    describe("View functions", function () {
        it("Should return correct student redemptions", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 10n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });

            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            const redemptions = await badgeSystem.read.getStudentRedemptions([student1.account.address]);
            assert.equal(redemptions.length, 2);
            assert.equal(redemptions[0], 1n);
            assert.equal(redemptions[1], 2n);
        });

        it("Should return correct student use requests", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createSubjectBadge({ account: professor1.account });
            await badgeSystem.write.createAssignment([1n], { account: professor1.account });
            await badgeSystem.write.addPrizeCategory([1n, 10n, 5n], { account: professor1.account });
            await badgeSystem.write.awardPrize([1n, [student1.account.address]], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });

            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            const useRequests = await badgeSystem.read.getStudentUseRequests([student1.account.address]);
            assert.equal(useRequests.length, 2);
        });
    });
});
