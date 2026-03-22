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

        const [, professor1, professor2, student1, student2, outsider] = await viem.getWalletClients();
        const professorRole = await campusRoles.read.PROFESSOR_ROLE();
        const studentRole = await campusRoles.read.STUDENT_ROLE();

        await campusRoles.write.registerUser([professor1.account.address, "Prof1", professorRole]);
        await campusRoles.write.registerUser([professor2.account.address, "Prof2", professorRole]);
        await campusRoles.write.registerUser([student1.account.address, "Student1", studentRole]);
        await campusRoles.write.registerUser([student2.account.address, "Student2", studentRole]);

        return { badgeSystem, campusRoles, professor1, professor2, student1, student2, outsider };
    }

    describe("Deployment", function () {
        it("Should set references and counters", async function () {
            const { badgeSystem, campusRoles } = await deploySystem();
            assert.equal(getAddress(await badgeSystem.read.campusRoles()), getAddress(campusRoles.address));
            assert.equal(await badgeSystem.read.nextBadgeTypeId(), 1n);
            assert.equal(await badgeSystem.read.nextTaskId(), 1n);
            assert.equal(await badgeSystem.read.nextRewardId(), 1n);
            assert.equal(await badgeSystem.read.nextRedemptionId(), 1n);
        });
    });

    describe("Badge type and tasks", function () {
        it("Should create badge type and task", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            const badgeType = await badgeSystem.read.getBadgeType([1n]);
            assert.equal(getAddress(badgeType.creator), getAddress(professor1.account.address));
            assert.equal(badgeType.exists, true);

            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });
            const task = await badgeSystem.read.getTask([1n]);
            assert.equal(task.badgeTypeId, 1n);
            assert.equal(task.rewardAmount, 5n);
            assert.equal(task.active, true);
        });

        it("Should enforce ownership and role checks", async function () {
            const { badgeSystem, professor1, professor2, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.createTask([1n, 1n], { account: professor2.account });
            });

            await assert.rejects(async () => {
                await badgeSystem.write.createBadgeType({ account: student1.account });
            });
        });
    });

    describe("Award and rewards", function () {
        it("Should award badges and redeem rewards", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });

            assert.equal(await badgeSystem.read.getBadgeBalance([student1.account.address, 1n]), 5n);

            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            assert.equal(await badgeSystem.read.getBadgeBalance([student1.account.address, 1n]), 2n);
            const reward = await badgeSystem.read.getReward([1n]);
            assert.equal(reward.supply, 9n);
        });

        it("Should emit RewardRedeemed", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 5n], { account: professor1.account });

            await viem.assertions.emitWithArgs(
                badgeSystem.write.redeemReward([1n], { account: student1.account }),
                badgeSystem,
                "RewardRedeemed",
                [1n, getAddress(student1.account.address), 1n, 2n, 1n],
            );
        });

        it("Should revert on double award and insufficient badges", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 2n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            });

            await badgeSystem.write.createReward([1n, 10n, 5n], { account: professor1.account });
            await assert.rejects(async () => {
                await badgeSystem.write.redeemReward([1n], { account: student1.account });
            });
        });
    });

    describe("Reward use flow", function () {
        it("Should create, approve and burn reward token", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            await badgeSystem.write.requestUseReward([1n], { account: student1.account });
            await badgeSystem.write.approveUseRequest([1n], { account: professor1.account });

            const req = await badgeSystem.read.getUseRequest([1n]);
            assert.equal(req.status, 2);

            const rewardTokenId = await badgeSystem.read.getRewardTokenId([1n]);
            assert.equal(await badgeSystem.read.balanceOf([student1.account.address, rewardTokenId]), 0n);
        });
    });

    describe("Soulbound enforcement", function () {
        it("Should block transfers and approvals", async function () {
            const { badgeSystem, professor1, student1, student2 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 1n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });

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
    });

    describe("Events", function () {
        it("Should emit BadgeTypeCreated and TaskCreated", async function () {
            const { badgeSystem, professor1 } = await deploySystem();
            const fromBlock = await publicClient.getBlockNumber();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });

            const badgeEvents = await publicClient.getContractEvents({
                address: badgeSystem.address,
                abi: badgeSystem.abi,
                eventName: "BadgeTypeCreated",
                fromBlock,
                strict: true,
            });
            const taskEvents = await publicClient.getContractEvents({
                address: badgeSystem.address,
                abi: badgeSystem.abi,
                eventName: "TaskCreated",
                fromBlock,
                strict: true,
            });

            assert.equal(badgeEvents.length, 1);
            assert.equal(taskEvents.length, 1);
            assert.equal(taskEvents[0].args.taskId, 1n);
        });
    });

    describe("deactivateTask", function () {
        it("Should deactivate a task successfully", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });

            await badgeSystem.write.deactivateTask([1n], { account: professor1.account });

            const task = await badgeSystem.read.getTask([1n]);
            assert.equal(task.active, false);
        });

        it("Should revert with TaskNotFound for non-existent task", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.deactivateTask([999n], { account: professor1.account });
            });
        });

        it("Should revert with NotTaskOwner when called by different professor", async function () {
            const { badgeSystem, professor1, professor2 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.deactivateTask([1n], { account: professor2.account });
            });
        });
    });

    describe("deactivateReward", function () {
        it("Should deactivate a reward successfully", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });

            await badgeSystem.write.deactivateReward([1n], { account: professor1.account });

            const reward = await badgeSystem.read.getReward([1n]);
            assert.equal(reward.active, false);
        });

        it("Should revert with RewardNotFound for non-existent reward", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.deactivateReward([999n], { account: professor1.account });
            });
        });

        it("Should revert with NotRewardOwner when called by different professor", async function () {
            const { badgeSystem, professor1, professor2 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 3n, 10n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.deactivateReward([1n], { account: professor2.account });
            });
        });
    });

    describe("cancelUseRequest", function () {
        it("Should cancel a pending use request", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.cancelUseRequest([1n], { account: student1.account });

            const req = await badgeSystem.read.getUseRequest([1n]);
            assert.equal(req.status, 4); // Cancelled
        });

        it("Should revert with UseRequestNotFound for non-existent request", async function () {
            const { badgeSystem, student1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.cancelUseRequest([999n], { account: student1.account });
            });
        });

        it("Should revert with NotRequestOwner when called by different student", async function () {
            const { badgeSystem, professor1, student1, student2 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.cancelUseRequest([1n], { account: student2.account });
            });
        });

        it("Should revert with InvalidUseRequestState when request is not Pending", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.cancelUseRequest([1n], { account: student1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.cancelUseRequest([1n], { account: student1.account });
            });
        });
    });

    describe("rejectUseRequest", function () {
        it("Should reject a pending use request", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.rejectUseRequest([1n], { account: professor1.account });

            const req = await badgeSystem.read.getUseRequest([1n]);
            assert.equal(req.status, 3); // Rejected
        });

        it("Should revert with UseRequestNotFound for non-existent request", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.rejectUseRequest([999n], { account: professor1.account });
            });
        });

        it("Should revert with InvalidUseRequestState when request is not Pending", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.rejectUseRequest([1n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.rejectUseRequest([1n], { account: professor1.account });
            });
        });

        it("Should revert with NotRewardOwner when called by different professor", async function () {
            const { badgeSystem, professor1, professor2, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.rejectUseRequest([1n], { account: professor2.account });
            });
        });
    });

    describe("safeBatchTransferFrom soulbound", function () {
        it("Should revert with SoulboundTransferBlocked", async function () {
            const batchAbi = parseAbi([
                "function safeBatchTransferFrom(address from,address to,uint256[] ids,uint256[] values,bytes data)",
            ]);

            const { badgeSystem, professor1, student1, student2 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 1n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });

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

    describe("createTask additional reverts", function () {
        it("Should revert with BadgeTypeNotFound for non-existent badgeTypeId", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.createTask([999n, 5n], { account: professor1.account });
            });
        });

        it("Should revert with ZeroRewardAmount when rewardAmount is 0", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.createTask([1n, 0n], { account: professor1.account });
            });
        });
    });

    describe("awardBadge additional reverts", function () {
        it("Should revert with TaskNotFound for non-existent taskId", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.awardBadge([999n, student1.account.address], { account: professor1.account });
            });
        });

        it("Should revert with TaskNotActive when task is deactivated", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });
            await badgeSystem.write.deactivateTask([1n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            });
        });

        it("Should revert with NotStudent when target is not a student", async function () {
            const { badgeSystem, professor1, outsider } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.awardBadge([1n, outsider.account.address], { account: professor1.account });
            });
        });
    });

    describe("createReward additional reverts", function () {
        it("Should revert with BadgeTypeNotFound for non-existent badgeTypeId", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.createReward([999n, 3n, 10n], { account: professor1.account });
            });
        });

        it("Should revert with ZeroCost when badgeCost is 0", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.createReward([1n, 0n, 10n], { account: professor1.account });
            });
        });

        it("Should revert with NotProfessor when called by student", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.createReward([1n, 3n, 10n], { account: student1.account });
            });
        });
    });

    describe("redeemReward additional reverts", function () {
        it("Should revert with RewardNotFound for non-existent reward", async function () {
            const { badgeSystem, student1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.redeemReward([999n], { account: student1.account });
            });
        });

        it("Should revert with RewardInactive when reward is deactivated", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.deactivateReward([1n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.redeemReward([1n], { account: student1.account });
            });
        });

        it("Should revert with RewardOutOfSupply when supply is exhausted", async function () {
            const { badgeSystem, professor1, student1, student2 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            // Give student1 enough badges
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            // Give student2 enough badges
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });
            await badgeSystem.write.awardBadge([2n, student2.account.address], { account: professor1.account });

            // Create reward with supply of 1
            await badgeSystem.write.createReward([1n, 2n, 1n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.redeemReward([1n], { account: student2.account });
            });
        });

        it("Should revert with NotStudent when called by non-student", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.redeemReward([1n], { account: professor1.account });
            });
        });
    });

    describe("requestUseReward additional reverts", function () {
        it("Should revert with RewardNotFound for non-existent reward", async function () {
            const { badgeSystem, student1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.requestUseReward([999n], { account: student1.account });
            });
        });

        it("Should revert with InsufficientRewardTokens when student has no reward tokens", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.requestUseReward([1n], { account: student1.account });
            });
        });

        it("Should revert with NotStudent when called by non-student", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.requestUseReward([1n], { account: professor1.account });
            });
        });
    });

    describe("approveUseRequest additional reverts", function () {
        it("Should revert with UseRequestNotFound for non-existent request", async function () {
            const { badgeSystem, professor1 } = await deploySystem();

            await assert.rejects(async () => {
                await badgeSystem.write.approveUseRequest([999n], { account: professor1.account });
            });
        });

        it("Should revert with InvalidUseRequestState when request is not Pending", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.approveUseRequest([1n], { account: professor1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.approveUseRequest([1n], { account: professor1.account });
            });
        });

        it("Should revert with NotRewardOwner when called by different professor", async function () {
            const { badgeSystem, professor1, professor2, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 3n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await assert.rejects(async () => {
                await badgeSystem.write.approveUseRequest([1n], { account: professor2.account });
            });
        });
    });

    describe("View functions", function () {
        it("Should return correct student redemptions via getStudentRedemptions", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 10n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });

            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            const redemptions = await badgeSystem.read.getStudentRedemptions([student1.account.address]);
            assert.equal(redemptions.length, 2);
            assert.equal(redemptions[0], 1n);
            assert.equal(redemptions[1], 2n);
        });

        it("Should return correct redemption struct via getRedemption", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 5n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });
            await badgeSystem.write.redeemReward([1n], { account: student1.account });

            const redemption = await badgeSystem.read.getRedemption([1n]);
            assert.equal(getAddress(redemption.student), getAddress(student1.account.address));
            assert.equal(redemption.rewardId, 1n);
            assert.ok(redemption.timestamp > 0n);
        });

        it("Should return correct student use requests via getStudentUseRequests", async function () {
            const { badgeSystem, professor1, student1 } = await deploySystem();

            await badgeSystem.write.createBadgeType({ account: professor1.account });
            await badgeSystem.write.createTask([1n, 10n], { account: professor1.account });
            await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor1.account });
            await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor1.account });

            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            await badgeSystem.write.redeemReward([1n], { account: student1.account });
            await badgeSystem.write.requestUseReward([1n], { account: student1.account });

            const useRequests = await badgeSystem.read.getStudentUseRequests([student1.account.address]);
            assert.equal(useRequests.length, 2);
            assert.equal(useRequests[0], 1n);
            assert.equal(useRequests[1], 2n);
        });
    });
});
