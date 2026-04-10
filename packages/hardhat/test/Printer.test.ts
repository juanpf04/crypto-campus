import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, zeroAddress } from "viem";

// Basic integration tests for Printer using Hardhat + viem.
describe("Printer", async function () {
    const { viem } = await network.connect();

    // Helper: despliega CampusRoles + Printer y registra un estudiante + librarian.
    async function deployWithStudent() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const printer = await viem.deployContract("Printer", [campusRoles.address]);
        const [admin, student, librarian, professor] = await viem.getWalletClients();
        const studentRole = await campusRoles.read.STUDENT_ROLE();
        const librarianRole = await campusRoles.read.LIBRARIAN_ROLE();
        const professorRole = await campusRoles.read.PROFESSOR_ROLE();

        await campusRoles.write.registerUser([student.account.address, "TestStudent", studentRole]);
        await campusRoles.write.registerUser([librarian.account.address, "TestLibrarian", librarianRole]);
        await campusRoles.write.registerUser([professor.account.address, "TestProfessor", professorRole]);

        return { campusRoles, printer, admin, student, librarian, professor, studentRole };
    }

    // Helper: solo despliega contratos sin registrar estudiante.
    async function deployOnly() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const printer = await viem.deployContract("Printer", [campusRoles.address]);
        return { campusRoles, printer };
    }


    describe("Deployment", function () {
        it("Should set campusRoles reference correctly", async function () {
            const { campusRoles, printer } = await deployOnly();

            assert.equal(
                getAddress(await printer.read.campusRoles()),
                getAddress(campusRoles.address),
            );
        });
    });


    describe("Basic credits", function () {
        it("Should return -1 credits for unregistered users", async function () {
            const { printer } = await deployOnly();
            const [, randomUser] = await viem.getWalletClients();

            assert.equal(
                await printer.read.getCredits([randomUser.account.address]),
                -1n,
            );
        });

        it("Should return max credits for admin (unlimited)", async function () {
            const { printer, admin } = await deployWithStudent();

            assert.equal(
                await printer.read.getCredits([admin.account.address]),
                BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), // type(int256).max
            );
        });

        it("Should return max credits for librarian (unlimited)", async function () {
            const { printer, librarian } = await deployWithStudent();

            assert.equal(
                await printer.read.getCredits([librarian.account.address]),
                BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
            );
        });

        it("Should return INITIAL_CREDITS for professor", async function () {
            const { printer, professor } = await deployWithStudent();

            assert.equal(
                await printer.read.getCredits([professor.account.address]),
                200n,
            );
        });
    });


    describe("setCredits", function () {
        it("Should set credits for a registered student and emit CreditsSet", async function () {
            const { printer, student } = await deployWithStudent();

            await viem.assertions.emitWithArgs(
                printer.write.setCredits([student.account.address, 120n]),
                printer,
                "CreditsSet",
                [getAddress(student.account.address), 120n],
            );

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                120n,
            );
        });

        it("Should allow setting credits to 0", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 0n]);

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                0n,
            );
        });

        it("Should allow setting credits above typical values", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 1000n]);

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                1000n,
            );
        });

        it("Should revert setCredits for non-student", async function () {
            const { printer } = await deployOnly();
            const [, randomUser] = await viem.getWalletClients();

            await assert.rejects(async () => {
                await printer.write.setCredits([randomUser.account.address, 100n]);
            });
        });
    });


    describe("print", function () {
        it("Should consume credits when printing and emit PrintJobExecuted", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 50n]);

            await viem.assertions.emitWithArgs(
                printer.write.print([student.account.address, 15n]),
                printer,
                "PrintJobExecuted",
                [getAddress(student.account.address), 15n, 35n],
            );

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                35n,
            );
        });

        it("Should handle multiple prints correctly", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 100n]);

            await printer.write.print([student.account.address, 50n]);
            await printer.write.print([student.account.address, 30n]);
            await printer.write.print([student.account.address, 20n]);

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                0n,
            );
        });

        it("Should allow printing all remaining credits (within limit)", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 50n]);

            await printer.write.print([student.account.address, 50n]);

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                0n,
            );
        });

        it("Should fail to print when requested pages exceed available credits", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 10n]);

            await assert.rejects(async () => {
                await printer.write.print([student.account.address, 20n]);
            });
        });

        it("Should revert print for non-student", async function () {
            const { printer } = await deployOnly();
            const [, randomUser] = await viem.getWalletClients();

            await assert.rejects(async () => {
                await printer.write.print([randomUser.account.address, 10n]);
            });
        });

        it("Should allow printing after setCredits restores credits", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 50n]);

            // Agotar créditos
            await printer.write.print([student.account.address, 50n]);
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                0n,
            );

            // Restaurar créditos e imprimir de nuevo
            await printer.write.setCredits([student.account.address, 100n]);
            await printer.write.print([student.account.address, 25n]);

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                75n,
            );
        });
    });


    describe("Multiple students", function () {
        it("Should track credits independently per student", async function () {
            const { campusRoles, printer, student: student1, studentRole } = await deployWithStudent();

            const [, , , , student2] = await viem.getWalletClients();
            await campusRoles.write.registerUser([
                student2.account.address,
                "Student2",
                studentRole,
            ]);

            await printer.write.setCredits([student1.account.address, 100n]);
            await printer.write.setCredits([student2.account.address, 200n]);
            await printer.write.print([student1.account.address, 50n]);

            assert.equal(
                await printer.read.getCredits([student1.account.address]),
                50n,
            );

            assert.equal(
                await printer.read.getCredits([student2.account.address]),
                200n,
            );
        });

        it("Should handle setCredits independently for multiple students", async function () {
            const { campusRoles, printer, student: student1, studentRole } = await deployWithStudent();

            const [, , , , student2] = await viem.getWalletClients();
            await campusRoles.write.registerUser([
                student2.account.address,
                "Student2",
                studentRole,
            ]);

            await printer.write.setCredits([student1.account.address, 300n]);
            await printer.write.setCredits([student2.account.address, 150n]);

            assert.equal(
                await printer.read.getCredits([student1.account.address]),
                300n,
            );

            assert.equal(
                await printer.read.getCredits([student2.account.address]),
                150n,
            );
        });
    });


    describe("setCredits reverts", function () {
        it("Should revert on zero address", async function () {
            const { printer } = await deployWithStudent();

            await assert.rejects(async () => {
                await printer.write.setCredits([zeroAddress, 100n]);
            });
        });

        it("Should revert for non-admin caller", async function () {
            const { printer, student } = await deployWithStudent();

            await assert.rejects(async () => {
                await printer.write.setCredits([student.account.address, 100n], { account: student.account });
            });
        });
    });


    describe("print reverts", function () {
        it("Should revert on zero address", async function () {
            const { printer } = await deployWithStudent();

            await assert.rejects(async () => {
                await printer.write.print([zeroAddress, 10n]);
            });
        });

        it("Should revert on zero pages", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 100n]);

            await assert.rejects(async () => {
                await printer.write.print([student.account.address, 0n]);
            });
        });

        it("Should revert for non-admin caller", async function () {
            const { printer, student } = await deployWithStudent();

            await assert.rejects(async () => {
                await printer.write.print([student.account.address, 10n], { account: student.account });
            });
        });
    });


    describe("INITIAL_CREDITS default behavior", function () {
        it("Should print using default INITIAL_CREDITS without calling setCredits", async function () {
            const { printer, student } = await deployWithStudent();

            // Print without ever calling setCredits — should use INITIAL_CREDITS (200)
            await printer.write.print([student.account.address, 50n]);

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                150n,
            );
        });

        it("Should return INITIAL_CREDITS for newly registered student without setCredits", async function () {
            const { printer, student } = await deployWithStudent();

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                200n,
            );
        });
    });

    describe("Unlimited credits (Admin/Librarian)", function () {
        it("Should allow admin to print without consuming credits", async function () {
            const { printer, admin } = await deployWithStudent();

            // Admin prints — no credit deduction
            await printer.write.print([admin.account.address, 30n]);

            // Credits still unlimited
            assert.equal(
                await printer.read.getCredits([admin.account.address]),
                BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
            );
        });

        it("Should allow librarian to print without consuming credits", async function () {
            const { printer, librarian } = await deployWithStudent();

            await printer.write.print([librarian.account.address, 50n]);

            assert.equal(
                await printer.read.getCredits([librarian.account.address]),
                BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
            );
        });

        it("Should deduct credits for professor", async function () {
            const { printer, professor } = await deployWithStudent();

            await printer.write.print([professor.account.address, 30n]);

            assert.equal(
                await printer.read.getCredits([professor.account.address]),
                170n, // 200 - 30
            );
        });
    });


    describe("MAX_PAGES_PER_JOB limit", function () {
        it("Should allow printing exactly 50 pages", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.print([student.account.address, 50n]);

            assert.equal(
                await printer.read.getCredits([student.account.address]),
                150n, // 200 - 50
            );
        });

        it("Should revert when printing more than 50 pages", async function () {
            const { printer, student } = await deployWithStudent();

            await assert.rejects(async () => {
                await printer.write.print([student.account.address, 51n]);
            });
        });

        it("Should enforce limit even for admin (unlimited credits)", async function () {
            const { printer, admin } = await deployWithStudent();

            await assert.rejects(async () => {
                await printer.write.print([admin.account.address, 51n]);
            });
        });
    });


    describe("Pausable", function () {
        it("Should allow admin to pause", async function () {
            const { printer } = await deployOnly();

            await printer.write.pause();
            assert.equal(await printer.read.paused(), true);
        });

        it("Should revert pause when called by non-admin", async function () {
            const { printer } = await deployWithStudent();
            const [, , outsider] = await viem.getWalletClients();

            await assert.rejects(async () => {
                await printer.write.pause({ account: outsider.account });
            });
        });

        it("Should revert print when paused", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 100n]);
            await printer.write.pause();

            await assert.rejects(async () => {
                await printer.write.print([student.account.address, 10n]);
            });
        });

        it("Should restore functionality after unpause", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 100n]);
            await printer.write.pause();
            await printer.write.unpause();

            await printer.write.print([student.account.address, 10n]);
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                90n,
            );
        });
    });
});
