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
});
