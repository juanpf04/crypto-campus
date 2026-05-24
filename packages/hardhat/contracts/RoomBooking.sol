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

    /// @notice Datos de una reserva de sala
    /// @dev `date` es el timestamp truncado a medianoche del dia.
    ///      `startHour` (0-23) y `duration` (1-4 horas).
    struct Booking {
        uint256 roomId;
        address student;
        uint256 date;
        uint8 startHour;
        uint8 duration;
        bool cancelled;
    }

    // ── State variables ─────────────────────────────────────────────────

    /// @notice Contador autoincremental de salas
    uint256 public nextRoomId = 1;
    /// @dev Registro de salas por ID
    mapping(uint256 => Room) private _rooms;

    /// @notice Contador autoincremental de reservas
    uint256 public nextBookingId = 1;
    /// @dev Registro de reservas por ID
    mapping(uint256 => Booking) private _bookings;

    /// @notice Indica si un slot horario esta ocupado
    /// @dev Clave: roomId => date => hour => occupied
    mapping(uint256 => mapping(uint256 => mapping(uint8 => bool))) public slotOccupied;

    /// @notice Reserva diaria de un estudiante (0 = sin reserva ese dia)
    /// @dev Clave: student => date => bookingId
    mapping(address => mapping(uint256 => uint256)) public studentDailyBooking;

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Se emite al crear una nueva sala
    /// @param roomId ID de la sala creada
    /// @param capacity Capacidad de la sala
    event RoomAdded(uint256 indexed roomId, uint256 capacity);

    /// @notice Se emite al actualizar una sala
    /// @param roomId ID de la sala
    /// @param capacity Nueva capacidad
    /// @param active Nuevo estado activo
    event RoomUpdated(uint256 indexed roomId, uint256 capacity, bool active);

    /// @notice Se emite al desactivar definitivamente una sala
    /// @param roomId ID de la sala eliminada
    event RoomRemoved(uint256 indexed roomId);

    /// @notice Se emite al crear una nueva reserva
    /// @param bookingId ID de la reserva
    /// @param roomId ID de la sala reservada
    /// @param student Direccion del estudiante
    /// @param date Dia reservado (timestamp a medianoche)
    /// @param startHour Hora de inicio (0-23)
    /// @param duration Duracion en horas (1-4)
    event RoomBooked(uint256 indexed bookingId, uint256 indexed roomId, address indexed student, uint256 date, uint8 startHour, uint8 duration);

    /// @notice Se emite al cancelar una reserva
    /// @param bookingId ID de la reserva cancelada
    /// @param cancelledBy Direccion que ejecuta la cancelacion
    event BookingCancelled(uint256 indexed bookingId, address indexed cancelledBy);

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice Caller sin rol librarian/admin
    error NotLibrarian();
    /// @notice Caller sin rol student
    error NotStudent();
    /// @notice Caller sin rol admin
    error NotAdmin();
    /// @notice La sala no existe
    /// @param roomId ID de la sala solicitada
    error RoomNotFound(uint256 roomId);
    /// @notice La sala existe pero esta desactivada
    /// @param roomId ID de la sala
    error RoomNotActive(uint256 roomId);
    /// @notice La duracion solicitada no esta dentro de [1,4]
    /// @param duration Duracion recibida
    error InvalidDuration(uint8 duration);
    /// @notice La hora de inicio o el rango total supera las 24h del dia
    /// @param startHour Hora de inicio recibida
    /// @param duration Duracion recibida
    error InvalidHour(uint8 startHour, uint8 duration);
    /// @notice Alguno de los slots solicitados ya esta ocupado
    /// @param roomId ID de la sala
    /// @param date Dia solicitado
    /// @param hour Hora ocupada
    error SlotAlreadyOccupied(uint256 roomId, uint256 date, uint8 hour);
    /// @notice El estudiante ya tiene reserva ese dia
    /// @param student Direccion del estudiante
    /// @param date Dia ya reservado
    error AlreadyBookedToday(address student, uint256 date);
    /// @notice La reserva no existe
    /// @param bookingId ID de la reserva solicitada
    error BookingNotFound(uint256 bookingId);
    /// @notice La reserva ya estaba cancelada
    /// @param bookingId ID de la reserva
    error BookingAlreadyCancelled(uint256 bookingId);
    /// @notice El caller no es el propietario ni un bibliotecario/admin
    /// @param bookingId ID de la reserva
    /// @param caller Direccion que intenta operar
    error NotBookingOwnerOrLibrarian(uint256 bookingId, address caller);
    /// @notice La capacidad debe ser mayor que cero
    error ZeroCapacity();
    /// @notice El rango horario consultado es invalido
    /// @param fromHour Hora inicial
    /// @param toHour Hora final
    error InvalidHourRange(uint8 fromHour, uint8 toHour);

    // ── Modifiers ───────────────────────────────────────────────────────

    /// @notice Restringe la ejecucion a bibliotecarios o admins
    modifier onlyLibrarian() {
        if (!campusRoles.isLibrarian(msg.sender) && !campusRoles.isAdmin(msg.sender))
            revert NotLibrarian();
        _;
    }

    /// @notice Restringe la ejecucion a estudiantes
    modifier onlyStudent() {
        if (!campusRoles.isStudent(msg.sender))
            revert NotStudent();
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Inicializa el contrato con su referencia de control de acceso
    /// @param _campusRoles Direccion del contrato CampusRoles
    constructor(address _campusRoles) {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── Room management (librarian/admin) ───────────────────────────────

    /// @notice Crea una nueva sala
    /// @param capacity Capacidad de la sala (> 0)
    /// @return roomId ID asignado a la nueva sala
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
    /// @param roomId ID de la sala
    /// @param capacity Nueva capacidad (> 0)
    /// @param active Nuevo estado activo
    function updateRoom(uint256 roomId, uint256 capacity, bool active) external onlyLibrarian whenNotPaused {
        if (!_rooms[roomId].exists) revert RoomNotFound(roomId);
        if (capacity == 0) revert ZeroCapacity();

        _rooms[roomId].capacity = capacity;
        _rooms[roomId].active = active;

        emit RoomUpdated(roomId, capacity, active);
    }

    /// @notice Desactiva una sala permanentemente
    /// @param roomId ID de la sala a desactivar
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
    /// @return bookingId ID de la reserva creada
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

    /// @notice Cancela una reserva (estudiante propietario o bibliotecario/admin)
    /// @param bookingId ID de la reserva a cancelar
    function cancelBooking(uint256 bookingId) external whenNotPaused {
        Booking storage booking = _bookings[bookingId];
        if (booking.roomId == 0) revert BookingNotFound(bookingId);
        if (booking.cancelled) revert BookingAlreadyCancelled(bookingId);

        // Solo el estudiante o un bibliotecario/admin pueden cancelar
        bool isOwner = booking.student == msg.sender;
        bool canManage = campusRoles.isLibrarian(msg.sender) || campusRoles.isAdmin(msg.sender);

        if (!isOwner && !canManage)
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
        if (!campusRoles.isAdmin(msg.sender))
            revert NotAdmin();
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external {
        if (!campusRoles.isAdmin(msg.sender))
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
    /// @param roomId ID de la sala
    /// @param date Dia consultado (timestamp a medianoche)
    /// @param fromHour Hora inicial inclusive
    /// @param toHour Hora final exclusive
    /// @return available Array booleano por slot dentro del rango
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
