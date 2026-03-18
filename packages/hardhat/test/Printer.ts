import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

// Basic integration tests for Printer using Hardhat + viem.
describe("Printer", async function () {
    const { viem } = await network.connect();

    describe("Deployment", function () {
        it("Should set accessControl reference correctly", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            // Assert
            assert.equal(
                getAddress(await printer.read.accessControl()),
                getAddress(accessControl.address),
            );
        });
    });


    describe("Basic credits", function () {
        it("Should return -1 credits for non-students", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, randomUser] = await viem.getWalletClients();

            // Assert
            assert.equal(
                await printer.read.getCredits([randomUser.account.address]),
                -1n,
            );
        });

        it("Should return -1 for admin (not a student)", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [admin] = await viem.getWalletClients();

            // Assert
            assert.equal(
                await printer.read.getCredits([admin.account.address]),
                -1n,
            );
        });
    });


    describe("setCredits", function () {
        it("Should set credits for a registered student and emit CreditsSet", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student.account.address,
                "Alice",
                studentRole,
            ]);

            // Act + Assert (event payload)
            await viem.assertions.emitWithArgs(
                printer.write.setCredits([student.account.address, 120n]),
                printer,
                "CreditsSet",
                [getAddress(student.account.address), 120n],
            );

            // Assert (state)
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                120n,
            );
        });

        it("Should allow setting credits to 0", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student.account.address,
                "Bob",
                studentRole,
            ]);

            // Act
            await printer.write.setCredits([student.account.address, 0n]);

            // Assert
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                0n,
            );
        });

        it("Should allow setting credits above typical values", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student.account.address,
                "Carol",
                studentRole,
            ]);

            // Act
            await printer.write.setCredits([student.account.address, 1000n]);

            // Assert
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                1000n,
            );
        });

        it("Should revert setCredits for non-student", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, randomUser] = await viem.getWalletClients();

            // Act + Assert
            await assert.rejects(async () => {
                await printer.write.setCredits([randomUser.account.address, 100n]);
            });
        });
    });


    describe("print", function () {
        it("Should consume credits when printing and emit PrintJobExecuted", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student.account.address,
                "Bob",
                studentRole,
            ]);

            await printer.write.setCredits([student.account.address, 50n]);

            // Act + Assert (event payload)
            await viem.assertions.emitWithArgs(
                printer.write.print([student.account.address, 15n]),
                printer,
                "PrintJobExecuted",
                [getAddress(student.account.address), 15n, 35n],
            );

            // Assert (state)
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                35n,
            );
        });

        it("Should handle multiple prints correctly", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student.account.address,
                "Carol",
                studentRole,
            ]);

            await printer.write.setCredits([student.account.address, 100n]);

            // Act
            await printer.write.print([student.account.address, 50n]);
            await printer.write.print([student.account.address, 30n]);
            await printer.write.print([student.account.address, 20n]);

            // Assert
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                0n,
            );
        });

        it("Should allow printing all remaining credits", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student.account.address,
                "Dave",
                studentRole,
            ]);

            await printer.write.setCredits([student.account.address, 200n]);

            // Act
            await printer.write.print([student.account.address, 200n]);

            // Assert
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                0n,
            );
        });

        it("Should fail to print when requested pages exceed available credits", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student.account.address,
                "Eve",
                studentRole,
            ]);

            await printer.write.setCredits([student.account.address, 10n]);

            // Act + Assert
            await assert.rejects(async () => {
                await printer.write.print([student.account.address, 20n]);
            });
        });

        it("Should revert print for non-student", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, randomUser] = await viem.getWalletClients();

            // Act + Assert
            await assert.rejects(async () => {
                await printer.write.print([randomUser.account.address, 10n]);
            });
        });

        it("Should allow printing after setCredits restores credits", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student.account.address,
                "Frank",
                studentRole,
            ]);

            await printer.write.setCredits([student.account.address, 50n]);

            // Act - exhaust credits
            await printer.write.print([student.account.address, 50n]);
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                0n,
            );

            // Act - restore credits and print again
            await printer.write.setCredits([student.account.address, 100n]);
            await printer.write.print([student.account.address, 25n]);

            // Assert
            assert.equal(
                await printer.read.getCredits([student.account.address]),
                75n,
            );
        });
    });


    describe("Multiple students", function () {
        it("Should track credits independently per student", async function () {
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student1, student2] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student1.account.address,
                "Student1",
                studentRole,
            ]);

            await accessControl.write.registerUser([
                student2.account.address,
                "Student2",
                studentRole,
            ]);

            // Act
            await printer.write.setCredits([student1.account.address, 100n]);
            await printer.write.setCredits([student2.account.address, 200n]);
            await printer.write.print([student1.account.address, 50n]);

            // Assert
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
            // Arrange
            const accessControl = await viem.deployContract("CampusAccessControl");
            const printer = await viem.deployContract("Printer", [accessControl.address]);

            const [, student1, student2] = await viem.getWalletClients();
            const studentRole = await accessControl.read.STUDENT_ROLE();

            await accessControl.write.registerUser([
                student1.account.address,
                "Student1",
                studentRole,
            ]);

            await accessControl.write.registerUser([
                student2.account.address,
                "Student2",
                studentRole,
            ]);

            // Act
            await printer.write.setCredits([student1.account.address, 300n]);
            await printer.write.setCredits([student2.account.address, 150n]);

            // Assert
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
