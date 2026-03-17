import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

// Basic integration tests for Printer using Hardhat + viem.
describe("Printer", async function () {
  const { viem } = await network.connect();

  it("Should return -1 credits for non-students", async function () {
    // Arrange
    const accessControl = await viem.deployContract("CampusAccessControl");
    const printer = await viem.deployContract("Printer", [accessControl.address]);

    const [, randomUser] = await viem.getWalletClients();

    // Assert
    assert.equal(await printer.read.getCredits([randomUser.account.address]), -1n);
  });

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
    assert.equal(await printer.read.getCredits([student.account.address]), 120n);
  });

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
    assert.equal(await printer.read.getCredits([student.account.address]), 35n);
  });

  it("Should fail to print when requested pages exceed available credits", async function () {
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

    await printer.write.setCredits([student.account.address, 10n]);

    // Act + Assert
    await assert.rejects(async () => {
      await printer.write.print([student.account.address, 20n]);
    });
  });
});
