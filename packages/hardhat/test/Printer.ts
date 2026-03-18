import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

// Basic integration tests for Printer using Hardhat + viem.
describe("Printer", async function () {
    const { viem } = await network.connect();

    // Helper: despliega AccessControl + Printer y registra un estudiante.
    // Reutilizado en todos los describe para evitar repetir el deploy en cada test.
    async function deployWithStudent() {
        const accessControl = await viem.deployContract("CampusAccessControl");
        const printer = await viem.deployContract("Printer", [accessControl.address]);
        const [, student] = await viem.getWalletClients();
        const studentRole = await accessControl.read.STUDENT_ROLE();

        await accessControl.write.registerUser([
            student.account.address,
            "TestStudent",
            studentRole,
        ]);

        return { accessControl, printer, student, studentRole };
    }

    // Helper: solo despliega contratos sin registrar estudiante.
    async function deployOnly() {
        const accessControl = await viem.deployContract("CampusAccessControl");
        const printer = await viem.deployContract("Printer", [accessControl.address]);
        return { accessControl, printer };
    }


    describe("Deployment", function () {
        it("Should set accessControl reference correctly", async function () {
            const { accessControl, printer } = await deployOnly();

            assert.equal(
                getAddress(await printer.read.accessControl()),
                getAddress(accessControl.address),
            );
        });
    });


    describe("Basic credits", function () {
        it("Should return -1 credits for non-students", async function () {
            const { printer } = await deployOnly();
            const [, randomUser] = await viem.getWalletClients();

            assert.equal(
                await printer.read.getCredits([randomUser.account.address]),
                -1n,
            );
        });

        it("Should return -1 for admin (not a student)", async function () {
            const { printer } = await deployOnly();
            const [admin] = await viem.getWalletClients();

            assert.equal(
                await printer.read.getCredits([admin.account.address]),
                -1n,
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

        it("Should allow printing all remaining credits", async function () {
            const { printer, student } = await deployWithStudent();

            await printer.write.setCredits([student.account.address, 200n]);

            await printer.write.print([student.account.address, 200n]);

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
            const { accessControl, printer, student: student1, studentRole } = await deployWithStudent();

            const [, , student2] = await viem.getWalletClients();
            await accessControl.write.registerUser([
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
            const { accessControl, printer, student: student1, studentRole } = await deployWithStudent();

            const [, , student2] = await viem.getWalletClients();
            await accessControl.write.registerUser([
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
});
