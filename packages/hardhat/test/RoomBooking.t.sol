// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { RoomBooking } from "../contracts/RoomBooking.sol";

/// @title RoomBookingTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas de comportamiento y reverts para la gestion de salas y reservas.
contract RoomBookingTest is Test {

    CampusRoles campusRoles;
    RoomBooking roomBooking;

    address librarian;
    address student;
    address student2;
    address outsider;

    uint256 tomorrow;

    function setUp() public {
        campusRoles = new CampusRoles();
        roomBooking = new RoomBooking(address(campusRoles));

        librarian = makeAddr("librarian");
        student = makeAddr("student");
        student2 = makeAddr("student2");
        outsider = makeAddr("outsider");

        campusRoles.registerUser(librarian, "Librarian", campusRoles.LIBRARIAN_ROLE());
        campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());
        campusRoles.registerUser(student2, "Student2", campusRoles.STUDENT_ROLE());

        // Dia de manana a medianoche
        tomorrow = (block.timestamp / 1 days + 1) * 1 days;

        vm.prank(librarian);
        roomBooking.addRoom(6);
    }

    // ── Room management ─────────────────────────────────────────────────

    function test_AddRoom() public {
        vm.prank(librarian);
        uint256 roomId = roomBooking.addRoom(10);

        (uint256 capacity, bool active) = roomBooking.getRoomInfo(roomId);
        assertEq(capacity, 10);
        assertTrue(active);
    }

    function test_UpdateRoom() public {
        vm.prank(librarian);
        roomBooking.updateRoom(1, 12, true);

        (uint256 capacity, bool active) = roomBooking.getRoomInfo(1);
        assertEq(capacity, 12);
        assertTrue(active);
    }

    function test_RemoveRoom() public {
        vm.prank(librarian);
        roomBooking.removeRoom(1);

        (, bool active) = roomBooking.getRoomInfo(1);
        assertFalse(active);
    }

    function test_RevertAddRoomZeroCapacity() public {
        vm.prank(librarian);
        vm.expectRevert(RoomBooking.ZeroCapacity.selector);
        roomBooking.addRoom(0);
    }

    function test_RevertAddRoomNotLibrarian() public {
        vm.prank(student);
        vm.expectRevert(RoomBooking.NotLibrarian.selector);
        roomBooking.addRoom(6);
    }

    function test_RevertUpdateRoomNotFound() public {
        vm.prank(librarian);
        vm.expectRevert(abi.encodeWithSelector(RoomBooking.RoomNotFound.selector, 999));
        roomBooking.updateRoom(999, 6, true);
    }

    // ── Booking flow ────────────────────────────────────────────────────

    function test_BookRoom() public {
        vm.prank(student);
        uint256 bookingId = roomBooking.bookRoom(1, tomorrow, 10, 2);

        RoomBooking.Booking memory booking = roomBooking.getBooking(bookingId);
        assertEq(booking.roomId, 1);
        assertEq(booking.student, student);
        assertEq(booking.startHour, 10);
        assertEq(booking.duration, 2);
        assertFalse(booking.cancelled);
    }

    function test_BookRoomSlotsOccupied() public {
        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        // Slots 10 y 11 ocupados, 12 libre
        assertFalse(roomBooking.isSlotAvailable(1, tomorrow, 10));
        assertFalse(roomBooking.isSlotAvailable(1, tomorrow, 11));
        assertTrue(roomBooking.isSlotAvailable(1, tomorrow, 12));
    }

    function test_CancelBookingByStudent() public {
        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        vm.prank(student);
        roomBooking.cancelBooking(1);

        RoomBooking.Booking memory booking = roomBooking.getBooking(1);
        assertTrue(booking.cancelled);

        // Slots liberados
        assertTrue(roomBooking.isSlotAvailable(1, tomorrow, 10));
        assertTrue(roomBooking.isSlotAvailable(1, tomorrow, 11));
    }

    function test_CancelBookingByLibrarian() public {
        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        vm.prank(librarian);
        roomBooking.cancelBooking(1);

        assertTrue(roomBooking.getBooking(1).cancelled);
    }

    // ── Booking restrictions ────────────────────────────────────────────

    function test_RevertBookInactiveRoom() public {
        vm.prank(librarian);
        roomBooking.removeRoom(1);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(RoomBooking.RoomNotActive.selector, 1));
        roomBooking.bookRoom(1, tomorrow, 10, 2);
    }

    function test_RevertBookDurationExceeds4() public {
        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(RoomBooking.InvalidDuration.selector, 5));
        roomBooking.bookRoom(1, tomorrow, 10, 5);
    }

    function test_RevertBookDurationZero() public {
        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(RoomBooking.InvalidDuration.selector, 0));
        roomBooking.bookRoom(1, tomorrow, 10, 0);
    }

    function test_RevertBookAlreadyBookedToday() public {
        vm.prank(librarian);
        roomBooking.addRoom(6); // room 2

        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(RoomBooking.AlreadyBookedToday.selector, student, tomorrow));
        roomBooking.bookRoom(2, tomorrow, 14, 1);
    }

    function test_RevertBookSlotOccupied() public {
        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        vm.prank(student2);
        vm.expectRevert(abi.encodeWithSelector(RoomBooking.SlotAlreadyOccupied.selector, 1, tomorrow, 11));
        roomBooking.bookRoom(1, tomorrow, 11, 2);
    }

    function test_RevertBookNotStudent() public {
        vm.prank(outsider);
        vm.expectRevert(RoomBooking.NotStudent.selector);
        roomBooking.bookRoom(1, tomorrow, 10, 2);
    }

    function test_RevertCancelNotOwnerNotLibrarian() public {
        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        vm.prank(student2);
        vm.expectRevert(abi.encodeWithSelector(RoomBooking.NotBookingOwnerOrLibrarian.selector, 1, student2));
        roomBooking.cancelBooking(1);
    }

    function test_RevertCancelAlreadyCancelled() public {
        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        vm.prank(student);
        roomBooking.cancelBooking(1);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(RoomBooking.BookingAlreadyCancelled.selector, 1));
        roomBooking.cancelBooking(1);
    }

    // ── View functions ──────────────────────────────────────────────────

    function test_GetRoomAvailability() public {
        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        bool[] memory avail = roomBooking.getRoomAvailability(1, tomorrow, 8, 14);
        assertEq(avail.length, 6);
        assertTrue(avail[0]);  // 8
        assertTrue(avail[1]);  // 9
        assertFalse(avail[2]); // 10 (ocupado)
        assertFalse(avail[3]); // 11 (ocupado)
        assertTrue(avail[4]);  // 12
        assertTrue(avail[5]);  // 13
    }

    function test_GetStudentBookingForDate() public {
        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        assertEq(roomBooking.getStudentBookingForDate(student, tomorrow), 1);
    }

    function test_IsSlotAvailableInactiveRoom() public {
        vm.prank(librarian);
        roomBooking.removeRoom(1);

        assertFalse(roomBooking.isSlotAvailable(1, tomorrow, 10));
    }

    // ── Pausable ────────────────────────────────────────────────────────

    function test_PauseAndUnpause() public {
        roomBooking.pause();

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        roomBooking.bookRoom(1, tomorrow, 10, 2);

        roomBooking.unpause();

        vm.prank(student);
        roomBooking.bookRoom(1, tomorrow, 10, 2);
    }
}
