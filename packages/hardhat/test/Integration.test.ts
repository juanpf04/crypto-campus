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
});
