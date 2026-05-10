// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { CampusRoles } from "./CampusRoles.sol";

/// @title RoomBooking
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Gestiona salas de estudio y reservas en la biblioteca del campus
/// @dev Las reservas son gratuitas. Maximo 4 horas consecutivas, 1 sala por estudiante al dia.
contract RoomBooking is ReentrancyGuard, Pausable {
    // ── Type declarations ───────────────────────────────────────────────

    CampusRoles public immutable campusRoles;

    /// @notice Datos de una sala de estudio
    struct Room {
        uint256 capacity;
        bool active;
        bool exists;
    }

    struct Booking {
        uint256 roomId;
        address student;
        uint256 date;       // timestamp truncado a medianoche (dia)
        uint8 startHour;    // 0-23
        uint8 duration;     // 1-4 horas
        bool cancelled;
    }

    // ── State variables ─────────────────────────────────────────────────

    uint256 public nextRoomId = 1;
    mapping(uint256 => Room) private _rooms;

    uint256 public nextBookingId = 1;
    mapping(uint256 => Booking) private _bookings;

    /// @notice roomId => date => hour => occupied
    mapping(uint256 => mapping(uint256 => mapping(uint8 => bool))) public slotOccupied;

    /// @notice student => date => bookingId (0 = no booking that day)
    mapping(address => mapping(uint256 => uint256)) public studentDailyBooking;

    // ── Events ──────────────────────────────────────────────────────────

    event RoomAdded(uint256 indexed roomId, uint256 capacity);
    event RoomUpdated(uint256 indexed roomId, uint256 capacity, bool active);
    event RoomRemoved(uint256 indexed roomId);
    event RoomBooked(uint256 indexed bookingId, uint256 indexed roomId, address indexed student, uint256 date, uint8 startHour, uint8 duration);
    event BookingCancelled(uint256 indexed bookingId, address indexed cancelledBy);

    // ── Errors ──────────────────────────────────────────────────────────

    error NotLibrarian();
    error NotStudent();
    error NotAdmin();
    error RoomNotFound(uint256 roomId);
    error RoomNotActive(uint256 roomId);
    error InvalidDuration(uint8 duration);
    error InvalidHour(uint8 startHour, uint8 duration);
    error SlotAlreadyOccupied(uint256 roomId, uint256 date, uint8 hour);
    error AlreadyBookedToday(address student, uint256 date);
    error BookingNotFound(uint256 bookingId);
    error BookingAlreadyCancelled(uint256 bookingId);
    error NotBookingOwnerOrLibrarian(uint256 bookingId, address caller);
    error RoomHasActiveBookings(uint256 roomId);
    error ZeroCapacity();
    error InvalidHourRange(uint8 fromHour, uint8 toHour);

    // ── Modifiers ───────────────────────────────────────────────────────

    modifier onlyLibrarian() {
        if (
            !campusRoles.hasRole(campusRoles.LIBRARIAN_ROLE(), msg.sender) &&
            !campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender)
        ) revert NotLibrarian();
        _;
    }

    modifier onlyStudent() {
        if (!campusRoles.hasRole(campusRoles.STUDENT_ROLE(), msg.sender))
            revert NotStudent();
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────────

    constructor(address _campusRoles) {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── Room management (librarian/admin) ───────────────────────────────

    /// @notice Crea una nueva sala
    function addRoom(uint256 capacity) external onlyLibrarian whenNotPaused returns (uint256 roomId) {
        if (capacity == 0) revert ZeroCapacity();

        roomId = nextRoomId;
        unchecked { ++nextRoomId; }

        _rooms[roomId] = Room({
            capacity: capacity,
            active: true,
            exists: true
        });

        emit RoomAdded(roomId, capacity);
    }

    /// @notice Actualiza capacidad y estado activo de una sala
    function updateRoom(uint256 roomId, uint256 capacity, bool active) external onlyLibrarian whenNotPaused {
        if (!_rooms[roomId].exists) revert RoomNotFound(roomId);
        if (capacity == 0) revert ZeroCapacity();

        _rooms[roomId].capacity = capacity;
        _rooms[roomId].active = active;

        emit RoomUpdated(roomId, capacity, active);
    }

    /// @notice Desactiva una sala permanentemente
    function removeRoom(uint256 roomId) external onlyLibrarian whenNotPaused {
        if (!_rooms[roomId].exists) revert RoomNotFound(roomId);

        _rooms[roomId].active = false;

        emit RoomRemoved(roomId);
    }

    // ── Booking flow (student) ──────────────────────────────────────────

    /// @notice Reserva una sala para un dia y rango horario
    /// @param roomId ID de la sala
    /// @param date Timestamp truncado a medianoche del dia
    /// @param startHour Hora de inicio (0-23)
    /// @param duration Numero de horas (1-4)
    function bookRoom(
        uint256 roomId,
        uint256 date,
        uint8 startHour,
        uint8 duration
    ) external onlyStudent whenNotPaused nonReentrant returns (uint256 bookingId) {
        // Validar sala
        if (!_rooms[roomId].exists) revert RoomNotFound(roomId);
        if (!_rooms[roomId].active) revert RoomNotActive(roomId);

        // Validar duracion
        if (duration == 0 || duration > 4) revert InvalidDuration(duration);

        // Validar horas
        if (startHour > 23 || uint8(startHour + duration) > 24)
            revert InvalidHour(startHour, duration);

        // Verificar limite diario (1 reserva por dia)
        if (studentDailyBooking[msg.sender][date] != 0)
            revert AlreadyBookedToday(msg.sender, date);

        // Verificar disponibilidad de todos los slots
        for (uint8 h = startHour; h < startHour + duration; h++) {
            if (slotOccupied[roomId][date][h])
                revert SlotAlreadyOccupied(roomId, date, h);
        }

        // Crear reserva
        bookingId = nextBookingId;
        unchecked { ++nextBookingId; }

        _bookings[bookingId] = Booking({
            roomId: roomId,
            student: msg.sender,
            date: date,
            startHour: startHour,
            duration: duration,
            cancelled: false
        });

        // Marcar slots como ocupados
        for (uint8 h = startHour; h < startHour + duration; h++) {
            slotOccupied[roomId][date][h] = true;
        }

        // Registrar reserva diaria del estudiante
        studentDailyBooking[msg.sender][date] = bookingId;

        emit RoomBooked(bookingId, roomId, msg.sender, date, startHour, duration);
    }

    /// @notice Cancela una reserva (estudiante propietario o bibliotecario)
    function cancelBooking(uint256 bookingId) external whenNotPaused {
        Booking storage booking = _bookings[bookingId];
        if (booking.roomId == 0) revert BookingNotFound(bookingId);
        if (booking.cancelled) revert BookingAlreadyCancelled(bookingId);

        // Solo el estudiante o un bibliotecario/admin pueden cancelar
        bool isOwner = booking.student == msg.sender;
        bool isLibrarian = campusRoles.hasRole(campusRoles.LIBRARIAN_ROLE(), msg.sender) ||
                           campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender);

        if (!isOwner && !isLibrarian)
            revert NotBookingOwnerOrLibrarian(bookingId, msg.sender);

        booking.cancelled = true;

        // Liberar slots
        for (uint8 h = booking.startHour; h < booking.startHour + booking.duration; h++) {
            slotOccupied[booking.roomId][booking.date][h] = false;
        }

        // Liberar limite diario del estudiante
        if (studentDailyBooking[booking.student][booking.date] == bookingId) {
            studentDailyBooking[booking.student][booking.date] = 0;
        }

        emit BookingCancelled(bookingId, msg.sender);
    }

    /// @notice Pausa el contrato (solo admin)
    function pause() external {
        if (!campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender))
            revert NotAdmin();
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external {
        if (!campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender))
            revert NotAdmin();
        _unpause();
    }

    // ── External view functions ─────────────────────────────────────────

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getRoomInfo(uint256 roomId) external view returns (uint256 capacity, bool active) {
        Room storage room = _rooms[roomId];
        return (room.capacity, room.active);
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getBooking(uint256 bookingId) external view returns (Booking memory) {
        return _bookings[bookingId];
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getStudentBookingForDate(address student, uint256 date) external view returns (uint256) {
        return studentDailyBooking[student][date];
    }

    /// @notice Consulta si un slot concreto esta disponible
    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function isSlotAvailable(uint256 roomId, uint256 date, uint8 hour) external view returns (bool) {
        if (!_rooms[roomId].active) return false;
        return !slotOccupied[roomId][date][hour];
    }

    /// @notice Consulta disponibilidad de un rango horario completo (ej: 8-20)
    function getRoomAvailability(
        uint256 roomId,
        uint256 date,
        uint8 fromHour,
        uint8 toHour
    ) external view returns (bool[] memory available) {
        if (toHour <= fromHour || toHour > 24) revert InvalidHourRange(fromHour, toHour);
        uint8 count = toHour - fromHour;
        available = new bool[](count);
        for (uint8 i = 0; i < count; i++) {
            available[i] = !slotOccupied[roomId][date][fromHour + i];
        }
    }
}
