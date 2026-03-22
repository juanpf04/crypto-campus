import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("Integration", async function () {
    const { viem } = await network.connect();

    async function deployAll() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const libraryToken = await viem.deployContract("LibraryToken", [campusRoles.address]);
        const shopToken = await viem.deployContract("ShopToken", [campusRoles.address]);
        const printer = await viem.deployContract("Printer", [campusRoles.address]);
        const libraryManager = await viem.deployContract("LibraryManager", [
            campusRoles.address,
            libraryToken.address,
            "https://library.ucm.es/",
        ]);
        const badgeSystem = await viem.deployContract("BadgeSystem", [
            campusRoles.address,
            "https://badges.ucm.es/",
        ]);
        const campusShop = await viem.deployContract("CampusShop", [
            campusRoles.address,
            shopToken.address,
            "https://shop.ucm.es/",
        ]);

        const [, librarian, professor, student1, student2] = await viem.getWalletClients();
        const librarianRole = await campusRoles.read.LIBRARIAN_ROLE();
        const professorRole = await campusRoles.read.PROFESSOR_ROLE();
        const studentRole = await campusRoles.read.STUDENT_ROLE();

        await campusRoles.write.registerUser([librarian.account.address, "Librarian", librarianRole]);
        await campusRoles.write.registerUser([professor.account.address, "Professor", professorRole]);
        await campusRoles.write.registerUser([student1.account.address, "Student1", studentRole]);
        await campusRoles.write.registerUser([student2.account.address, "Student2", studentRole]);

        await libraryToken.write.setTrustedSpender([libraryManager.address]);
        await shopToken.write.setTrustedSpender([campusShop.address]);

        await libraryToken.write.mint([student1.account.address, 10n]);
        await libraryToken.write.mint([student2.account.address, 10n]);
        await shopToken.write.mint([student1.account.address, 200n]);
        await shopToken.write.mint([student2.account.address, 150n]);

        return {
            campusRoles,
            libraryToken,
            shopToken,
            printer,
            libraryManager,
            badgeSystem,
            campusShop,
            librarian,
            professor,
            student1,
            student2,
        };
    }

    it("Should deploy full ecosystem and assign roles", async function () {
        const { campusRoles, librarian, professor, student1, student2, printer } = await deployAll();

        assert.equal(await campusRoles.read.isLibrarian([librarian.account.address]), true);
        assert.equal(await campusRoles.read.isProfessor([professor.account.address]), true);
        assert.equal(await campusRoles.read.isStudent([student1.account.address]), true);
        assert.equal(await campusRoles.read.isStudent([student2.account.address]), true);
        assert.equal(await printer.read.getCredits([student1.account.address]), 200n);
    });

    it("Should execute cross-contract day flow", async function () {
        const {
            libraryManager,
            campusShop,
            badgeSystem,
            printer,
            libraryToken,
            shopToken,
            librarian,
            professor,
            student1,
            student2,
        } = await deployAll();

        await libraryManager.write.addBook([5n], { account: librarian.account });
        await campusShop.write.addProduct([80n, 10n]);

        await badgeSystem.write.createBadgeType({ account: professor.account });
        await badgeSystem.write.createTask([1n, 3n], { account: professor.account });
        await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor.account });

        await libraryManager.write.requestLoan([1n], { account: student1.account });
        await libraryManager.write.approveLoan([1n], { account: librarian.account });

        await printer.write.print([student1.account.address, 15n]);
        await campusShop.write.purchase([1n], { account: student2.account });

        await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor.account });
        await badgeSystem.write.awardBadge([1n, student2.account.address], { account: professor.account });
        await badgeSystem.write.redeemReward([1n], { account: student1.account });

        assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 1n);
        assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n);
        assert.equal(await printer.read.getCredits([student1.account.address]), 185n);
        assert.equal(await badgeSystem.read.getBadgeBalance([student1.account.address, 1n]), 1n);
        assert.equal(await shopToken.read.balanceOf([student2.account.address]), 70n);
        assert.equal(await campusShop.read.balanceOf([student2.account.address, 1n]), 1n);
    });

    it("Should complete full library return flow", async function () {
        const { libraryManager, libraryToken, librarian, student1 } = await deployAll();

        // addBook with 2 copies
        await libraryManager.write.addBook([2n], { account: librarian.account });

        // student1 requests and gets loan approved (deposit of 1 LibraryToken taken)
        await libraryManager.write.requestLoan([1n], { account: student1.account });
        await libraryManager.write.approveLoan([1n], { account: librarian.account });

        // Verify: student has the book NFT and lost 1 deposit token
        assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 1n);
        assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n);

        // Librarian confirms return
        await libraryManager.write.confirmReturn([1n], { account: librarian.account });

        // Verify: book NFT returned to contract
        assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 0n);
        assert.equal(await libraryManager.read.balanceOf([libraryManager.address, 1n]), 2n);

        // Verify: LibraryToken deposit returned to student
        assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 10n);

        // Verify: loan status is Returned (4)
        const loan = await libraryManager.read.getLoanInfo([1n]);
        assert.equal(loan.status, 4);
    });

    it("Should complete full shop return flow", async function () {
        const { campusShop, shopToken, student1 } = await deployAll();

        // Add product: price 80, stock 5
        await campusShop.write.addProduct([80n, 5n]);

        // Student purchases (200 - 80 = 120 ShopTokens remaining)
        await campusShop.write.purchase([1n], { account: student1.account });
        assert.equal(await shopToken.read.balanceOf([student1.account.address]), 120n);
        assert.equal(await campusShop.read.balanceOf([student1.account.address, 1n]), 1n);

        // Admin marks as delivered
        await campusShop.write.markDelivered([1n]);

        // Student requests return within 30 days
        await campusShop.write.requestReturn([1n], { account: student1.account });

        // Verify: ShopTokens refunded (120 + 80 = 200)
        assert.equal(await shopToken.read.balanceOf([student1.account.address]), 200n);

        // Verify: receipt NFT burned (product token ID = 1)
        assert.equal(await campusShop.read.balanceOf([student1.account.address, 1n]), 0n);

        // Verify: return receipt NFT minted (RETURN_RECEIPT_OFFSET + orderId = 1_000_001)
        assert.equal(await campusShop.read.balanceOf([student1.account.address, 1_000_001n]), 1n);

        // Verify: stock restored (was 5, sold 1 → 4, returned → 5)
        const [, stock] = await campusShop.read.getProduct([1n]);
        assert.equal(stock, 5n);
    });

    it("Should complete full badge use-request flow", async function () {
        const { badgeSystem, professor, student1 } = await deployAll();

        // Professor creates badge type, task (reward 3 badges), and reward (cost 2 badges, supply 10)
        await badgeSystem.write.createBadgeType({ account: professor.account });
        await badgeSystem.write.createTask([1n, 3n], { account: professor.account });
        await badgeSystem.write.createReward([1n, 2n, 10n], { account: professor.account });

        // Professor awards badge to student1 (gets 3 badges of type 1)
        await badgeSystem.write.awardBadge([1n, student1.account.address], { account: professor.account });
        assert.equal(await badgeSystem.read.getBadgeBalance([student1.account.address, 1n]), 3n);

        // Student redeems reward (burns 2 badges, gets 1 reward token)
        await badgeSystem.write.redeemReward([1n], { account: student1.account });
        assert.equal(await badgeSystem.read.getBadgeBalance([student1.account.address, 1n]), 1n);

        // Reward token ID = REWARD_TOKEN_OFFSET + rewardId = 1_000_001
        assert.equal(await badgeSystem.read.balanceOf([student1.account.address, 1_000_001n]), 1n);

        // Student requests to use reward
        await badgeSystem.write.requestUseReward([1n], { account: student1.account });

        // Verify use request is Pending (1)
        const reqBefore = await badgeSystem.read.getUseRequest([1n]);
        assert.equal(reqBefore.status, 1);

        // Professor approves use request (burns reward token)
        await badgeSystem.write.approveUseRequest([1n], { account: professor.account });

        // Verify: reward token burned
        assert.equal(await badgeSystem.read.balanceOf([student1.account.address, 1_000_001n]), 0n);

        // Verify: use request status is Approved (2)
        const reqAfter = await badgeSystem.read.getUseRequest([1n]);
        assert.equal(reqAfter.status, 2);
    });

    it("Should block access in other contracts after role removal", async function () {
        const { campusRoles, libraryManager, campusShop, printer, librarian, student1 } = await deployAll();

        // Setup: add book and product
        await libraryManager.write.addBook([2n], { account: librarian.account });
        await campusShop.write.addProduct([80n, 10n]);

        // Give student1 printer credits (already has 200 by default, print to confirm access)
        await printer.write.print([student1.account.address, 1n]);
        assert.equal(await printer.read.getCredits([student1.account.address]), 199n);

        // Remove student1 from CampusRoles
        await campusRoles.write.removeUser([student1.account.address]);

        // Verify: printing reverts (NotStudent)
        await assert.rejects(async () => {
            await printer.write.print([student1.account.address, 1n]);
        });

        // Verify: library requestLoan reverts (NotStudent)
        await assert.rejects(async () => {
            await libraryManager.write.requestLoan([1n], { account: student1.account });
        });

        // Verify: shop purchase reverts (NotStudent)
        await assert.rejects(async () => {
            await campusShop.write.purchase([1n], { account: student1.account });
        });
    });

    it("Should penalize deposit on overdue forceReturn", async function () {
        const { libraryManager, libraryToken, librarian, student1 } = await deployAll();
        const publicClient = await viem.getPublicClient();

        async function increaseTime(seconds: number) {
            await publicClient.transport.request({ method: "evm_increaseTime" as never, params: [seconds] as never });
            await publicClient.transport.request({ method: "evm_mine" as never, params: [] as never });
        }

        // Add book, request and approve loan
        await libraryManager.write.addBook([2n], { account: librarian.account });
        await libraryManager.write.requestLoan([1n], { account: student1.account });
        await libraryManager.write.approveLoan([1n], { account: librarian.account });

        // Student has 9 tokens (1 held as deposit)
        assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n);

        // Advance time past due date (22 days > 21 day loan duration)
        await increaseTime(22 * 24 * 60 * 60);

        // Librarian forces return
        await libraryManager.write.forceReturn([1n], { account: librarian.account });

        // Verify: book returned to contract
        assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 0n);
        assert.equal(await libraryManager.read.balanceOf([libraryManager.address, 1n]), 2n);

        // Verify: deposit NOT returned (student still has 9, not 10)
        assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n);

        // Verify: loan status is Returned (4)
        const loan = await libraryManager.read.getLoanInfo([1n]);
        assert.equal(loan.status, 4);
    });

    it("Should support cross-contract token flow with refund and re-purchase", async function () {
        const { campusShop, shopToken, student1 } = await deployAll();

        // Initial balance: 200 ShopTokens
        assert.equal(await shopToken.read.balanceOf([student1.account.address]), 200n);

        // Add product: price 50, stock 5
        await campusShop.write.addProduct([50n, 5n]);

        // First purchase (200 - 50 = 150)
        await campusShop.write.purchase([1n], { account: student1.account });
        assert.equal(await shopToken.read.balanceOf([student1.account.address]), 150n);

        // Admin processes return (refund: 150 + 50 = 200)
        await campusShop.write.processReturn([1n]);
        assert.equal(await shopToken.read.balanceOf([student1.account.address]), 200n);

        // Verify stock restored
        const [, stockAfterReturn] = await campusShop.read.getProduct([1n]);
        assert.equal(stockAfterReturn, 5n);

        // Student buys again with refunded tokens (200 - 50 = 150)
        await campusShop.write.purchase([1n], { account: student1.account });
        assert.equal(await shopToken.read.balanceOf([student1.account.address]), 150n);
        assert.equal(await campusShop.read.balanceOf([student1.account.address, 1n]), 1n);
    });

    it("Should track multiple students with independent loan state", async function () {
        const { libraryManager, libraryToken, librarian, student1, student2 } = await deployAll();

        // Add book with 3 copies (enough for both students)
        await libraryManager.write.addBook([3n], { account: librarian.account });

        // Both students request loans for the same book
        await libraryManager.write.requestLoan([1n], { account: student1.account });
        await libraryManager.write.requestLoan([1n], { account: student2.account });

        // Both get approved
        await libraryManager.write.approveLoan([1n], { account: librarian.account });
        await libraryManager.write.approveLoan([2n], { account: librarian.account });

        // Verify both have the book and lost deposit
        assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 1n);
        assert.equal(await libraryManager.read.balanceOf([student2.account.address, 1n]), 1n);
        assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 9n);
        assert.equal(await libraryToken.read.balanceOf([student2.account.address]), 9n);

        // Contract should have 1 copy left (3 - 2 loaned)
        assert.equal(await libraryManager.read.balanceOf([libraryManager.address, 1n]), 1n);

        // Student1 returns the book
        await libraryManager.write.confirmReturn([1n], { account: librarian.account });

        // Verify student1 returned: no book NFT, deposit back
        assert.equal(await libraryManager.read.balanceOf([student1.account.address, 1n]), 0n);
        assert.equal(await libraryToken.read.balanceOf([student1.account.address]), 10n);
        const loan1 = await libraryManager.read.getLoanInfo([1n]);
        assert.equal(loan1.status, 4); // Returned

        // Verify student2 still has their loan active
        assert.equal(await libraryManager.read.balanceOf([student2.account.address, 1n]), 1n);
        assert.equal(await libraryToken.read.balanceOf([student2.account.address]), 9n);
        const loan2 = await libraryManager.read.getLoanInfo([2n]);
        assert.equal(loan2.status, 2); // Approved (still active)

        // Contract should have 2 copies now (1 returned + 1 not loaned)
        assert.equal(await libraryManager.read.balanceOf([libraryManager.address, 1n]), 2n);
    });

    it("Should pause and unpause all contracts via admin", async function () {
        const {
            campusRoles,
            libraryToken,
            shopToken,
            printer,
            libraryManager,
            badgeSystem,
            campusShop,
            librarian,
            professor,
            student1,
        } = await deployAll();

        // Pause all contracts
        await campusRoles.write.pause();
        await libraryToken.write.pause();
        await shopToken.write.pause();
        await printer.write.pause();
        await libraryManager.write.pause();
        await badgeSystem.write.pause();
        await campusShop.write.pause();

        // Verify all are paused
        assert.equal(await campusRoles.read.paused(), true);
        assert.equal(await libraryToken.read.paused(), true);
        assert.equal(await shopToken.read.paused(), true);
        assert.equal(await printer.read.paused(), true);
        assert.equal(await libraryManager.read.paused(), true);
        assert.equal(await badgeSystem.read.paused(), true);
        assert.equal(await campusShop.read.paused(), true);

        // Verify operations revert when paused
        await assert.rejects(async () => {
            await printer.write.print([student1.account.address, 1n]);
        });

        // Unpause all contracts
        await campusRoles.write.unpause();
        await libraryToken.write.unpause();
        await shopToken.write.unpause();
        await printer.write.unpause();
        await libraryManager.write.unpause();
        await badgeSystem.write.unpause();
        await campusShop.write.unpause();

        // Verify operations work after unpause
        await printer.write.print([student1.account.address, 1n]);
        assert.equal(await printer.read.getCredits([student1.account.address]), 199n);
    });
});
