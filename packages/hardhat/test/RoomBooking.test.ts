import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

describe("RoomBooking", async function () {
    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();

    /** Trunca un timestamp a medianoche (inicio del dia) */
    function toMidnight(date: Date): bigint {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return BigInt(Math.floor(d.getTime() / 1000));
    }

    async function deploySystem() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const roomBooking = await viem.deployContract("RoomBooking", [campusRoles.address]);

        const [, librarian, student1, student2, outsider] = await viem.getWalletClients();
        const librarianRole = await campusRoles.read.LIBRARIAN_ROLE();
        const studentRole = await campusRoles.read.STUDENT_ROLE();

        await campusRoles.write.registerUser([librarian.account.address, "Librarian", librarianRole]);
        await campusRoles.write.registerUser([student1.account.address, "Student1", studentRole]);
        await campusRoles.write.registerUser([student2.account.address, "Student2", studentRole]);

        return { campusRoles, roomBooking, librarian, student1, student2, outsider };
    }

    const tomorrow = toMidnight(new Date(Date.now() + 86400000));

    describe("Room management", function () {
        it("Should add a room", async function () {
            const { roomBooking, librarian } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            const [capacity, active] = await roomBooking.read.getRoomInfo([1n]);
            assert.equal(capacity, 6n);
            assert.equal(active, true);
        });

        it("Should update a room", async function () {
            const { roomBooking, librarian } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.updateRoom([1n, 10n, true], { account: librarian.account });

            const [capacity, active] = await roomBooking.read.getRoomInfo([1n]);
            assert.equal(capacity, 10n);
            assert.equal(active, true);
        });

        it("Should deactivate a room with removeRoom", async function () {
            const { roomBooking, librarian } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.removeRoom([1n], { account: librarian.account });

            const [, active] = await roomBooking.read.getRoomInfo([1n]);
            assert.equal(active, false);
        });

        it("Should revert addRoom for non-librarian", async function () {
            const { roomBooking, student1 } = await deploySystem();
            await assert.rejects(async () => {
                await roomBooking.write.addRoom([6n], { account: student1.account });
            });
        });

        it("Should revert addRoom with zero capacity", async function () {
            const { roomBooking, librarian } = await deploySystem();
            await assert.rejects(async () => {
                await roomBooking.write.addRoom([0n], { account: librarian.account });
            });
        });

        it("Should revert updateRoom for non-existent room", async function () {
            const { roomBooking, librarian } = await deploySystem();
            await assert.rejects(async () => {
                await roomBooking.write.updateRoom([999n, 6n, true], { account: librarian.account });
            });
        });
    });

    describe("Booking flow", function () {
        it("Should book a room successfully", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });

            const booking = await roomBooking.read.getBooking([1n]);
            assert.equal(booking.roomId, 1n);
            assert.equal(getAddress(booking.student), getAddress(student1.account.address));
            assert.equal(booking.startHour, 10);
            assert.equal(booking.duration, 2);
            assert.equal(booking.cancelled, false);
        });

        it("Should mark slots as occupied after booking", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });

            assert.equal(await roomBooking.read.isSlotAvailable([1n, tomorrow, 10]), false);
            assert.equal(await roomBooking.read.isSlotAvailable([1n, tomorrow, 11]), false);
            assert.equal(await roomBooking.read.isSlotAvailable([1n, tomorrow, 12]), true);
        });

        it("Should cancel booking and free slots", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });

            await roomBooking.write.cancelBooking([1n], { account: student1.account });

            const booking = await roomBooking.read.getBooking([1n]);
            assert.equal(booking.cancelled, true);
            assert.equal(await roomBooking.read.isSlotAvailable([1n, tomorrow, 10]), true);
            assert.equal(await roomBooking.read.isSlotAvailable([1n, tomorrow, 11]), true);
        });

        it("Should allow librarian to cancel booking", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });

            await roomBooking.write.cancelBooking([1n], { account: librarian.account });

            const booking = await roomBooking.read.getBooking([1n]);
            assert.equal(booking.cancelled, true);
        });
    });

    describe("Booking restrictions", function () {
        it("Should revert when booking inactive room", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.removeRoom([1n], { account: librarian.account });

            await assert.rejects(async () => {
                await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });
            });
        });

        it("Should revert when duration exceeds 4 hours", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await assert.rejects(async () => {
                await roomBooking.write.bookRoom([1n, tomorrow, 10, 5], { account: student1.account });
            });
        });

        it("Should revert when duration is 0", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await assert.rejects(async () => {
                await roomBooking.write.bookRoom([1n, tomorrow, 10, 0], { account: student1.account });
            });
        });

        it("Should revert when student already booked that day", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.addRoom([6n], { account: librarian.account });

            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });
            await assert.rejects(async () => {
                await roomBooking.write.bookRoom([2n, tomorrow, 14, 1], { account: student1.account });
            });
        });

        it("Should revert when slot already occupied", async function () {
            const { roomBooking, librarian, student1, student2 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });

            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });
            await assert.rejects(async () => {
                await roomBooking.write.bookRoom([1n, tomorrow, 11, 2], { account: student2.account });
            });
        });

        it("Should revert when non-student tries to book", async function () {
            const { roomBooking, librarian, outsider } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await assert.rejects(async () => {
                await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: outsider.account });
            });
        });

        it("Should revert cancel from non-owner non-librarian", async function () {
            const { roomBooking, librarian, student1, student2 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });

            await assert.rejects(async () => {
                await roomBooking.write.cancelBooking([1n], { account: student2.account });
            });
        });
    });

    describe("View functions", function () {
        it("getRoomAvailability should return correct slots", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });

            const availability = await roomBooking.read.getRoomAvailability([1n, tomorrow, 8, 14]);
            // Hours 8-13: [true, true, false, false, true, true]
            assert.equal(availability.length, 6);
            assert.equal(availability[0], true);  // 8
            assert.equal(availability[1], true);  // 9
            assert.equal(availability[2], false); // 10 (booked)
            assert.equal(availability[3], false); // 11 (booked)
            assert.equal(availability[4], true);  // 12
            assert.equal(availability[5], true);  // 13
        });

        it("getStudentBookingForDate should return booking ID", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });

            const bookingId = await roomBooking.read.getStudentBookingForDate([student1.account.address, tomorrow]);
            assert.equal(bookingId, 1n);
        });

        it("isSlotAvailable should return false for inactive room", async function () {
            const { roomBooking, librarian } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.removeRoom([1n], { account: librarian.account });

            assert.equal(await roomBooking.read.isSlotAvailable([1n, tomorrow, 10]), false);
        });
    });

    describe("Pausable", function () {
        it("Should allow admin to pause and unpause", async function () {
            const { roomBooking } = await deploySystem();

            await roomBooking.write.pause();
            assert.equal(await roomBooking.read.paused(), true);
            await roomBooking.write.unpause();
            assert.equal(await roomBooking.read.paused(), false);
        });

        it("Should revert pause when called by non-admin", async function () {
            const { roomBooking, outsider } = await deploySystem();

            await assert.rejects(async () => {
                await roomBooking.write.pause({ account: outsider.account });
            });
        });

        it("Should revert unpause when called by non-admin", async function () {
            const { roomBooking, outsider } = await deploySystem();

            await roomBooking.write.pause();
            await assert.rejects(async () => {
                await roomBooking.write.unpause({ account: outsider.account });
            });
        });

        it("Should revert bookRoom when paused", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.pause();

            await assert.rejects(async () => {
                await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });
            });
        });

        it("Should work after unpause", async function () {
            const { roomBooking, librarian, student1 } = await deploySystem();

            await roomBooking.write.addRoom([6n], { account: librarian.account });
            await roomBooking.write.pause();
            await roomBooking.write.unpause();

            await roomBooking.write.bookRoom([1n, tomorrow, 10, 2], { account: student1.account });
            const booking = await roomBooking.read.getBooking([1n]);
            assert.equal(booking.roomId, 1n);
        });
    });
});
