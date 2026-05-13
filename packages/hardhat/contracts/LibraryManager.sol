// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { CampusRoles } from "./CampusRoles.sol";
import { LibraryToken } from "./LibraryToken.sol";

/// @title LibraryManager
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Gestiona catalogo de libros y flujo de prestamos con cola de espera automatica.
/// @dev Cada token ID representa un titulo; el contrato custodia copias disponibles.
///      Flujo: requestLoan → RESERVED/QUEUED → confirmPickup → PICKED_UP → confirmReturn → RETURNED.
///      Cola FIFO automatica: cuando se libera una copia, el siguiente en cola pasa a RESERVED.
contract LibraryManager is ERC1155, ERC1155Supply, ERC1155Holder, ReentrancyGuard, Pausable {
    // ── Type declarations ───────────────────────────────────────────────

    /// @notice Referencia al control de acceso del campus
    CampusRoles public immutable campusRoles;

    /// @notice Token de deposito para prestamos
    LibraryToken public immutable libraryToken;

    /// @notice Duracion por defecto de un prestamo tras recogida
    uint256 public constant DEFAULT_LOAN_DURATION = 21 days;

    /// @notice Tiempo maximo para recoger un item reservado
    uint256 public constant RESERVATION_TIMEOUT = 3 days;

    /// @notice Deposito en token requerido por prestamo
    uint256 public constant DEPOSIT_PER_LOAN = 1;

    /// @notice Datos de un libro en el catalogo
    struct Book {
        uint256 totalCopies;
        bool exists;
    }

    /// @notice Estados posibles de un prestamo
    enum LoanStatus { None, Queued, Reserved, PickedUp, Returned, Cancelled }

    /// @notice Datos de un prestamo
    struct Loan {
        uint256 bookId;
        address student;
        LoanStatus status;
        uint40 requestDate;
        uint40 reservationDate;
        uint40 pickupDate;
        uint40 dueDate;
        uint40 returnDate;
    }

    // ── State variables ─────────────────────────────────────────────────

    /// @notice Contador autoincremental de libros
    uint256 public nextBookId = 1;
    /// @dev Catalogo de libros por ID
    mapping(uint256 => Book) private _books;

    /// @notice Contador autoincremental de prestamos
    uint256 public nextLoanId = 1;
    /// @dev Registro de prestamos por ID
    mapping(uint256 => Loan) private _loans;

    /// @notice Prestamo activo de un estudiante para un libro (0 = ninguno)
    mapping(address => mapping(uint256 => uint256)) public activeLoanByStudentAndBook;
    /// @dev Historico de IDs de prestamos de cada estudiante
    mapping(address => uint256[]) private _studentLoanIds;
    /// @notice Cantidad de prestamos recogidos (libros fisicamente con estudiantes) por libro
    mapping(uint256 => uint256) public activeLoansForBook;
    /// @notice Cantidad de copias reservadas (pendientes de recogida) por libro
    mapping(uint256 => uint256) public reservedCopiesForBook;
    /// @dev Cola FIFO de prestamos esperando una copia por libro
    mapping(uint256 => uint256[]) private _bookQueue;

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Se emite al anadir un nuevo libro al catalogo
    /// @param bookId ID del libro creado
    /// @param copies Numero de copias minteadas inicialmente
    event BookAdded(uint256 indexed bookId, uint256 copies);

    /// @notice Se emite al anadir copias adicionales a un libro existente
    /// @param bookId ID del libro
    /// @param additionalCopies Copias adicionales minteadas
    event BookCopiesAdded(uint256 indexed bookId, uint256 additionalCopies);

    /// @notice Se emite al desactivar un libro y quemar sus copias
    /// @param bookId ID del libro eliminado
    event BookRemoved(uint256 indexed bookId);

    /// @notice Se emite al solicitar un prestamo (en cola o reservado directo)
    /// @param loanId ID del prestamo solicitado
    /// @param student Direccion del estudiante
    /// @param bookId Libro solicitado
    /// @param queued True si entra en cola por falta de copias
    event LoanRequested(uint256 indexed loanId, address indexed student, uint256 indexed bookId, bool queued);

    /// @notice Se emite cuando un prestamo pasa a estado Reserved
    /// @param loanId ID del prestamo
    /// @param student Direccion del estudiante
    /// @param bookId Libro reservado
    event LoanReserved(uint256 indexed loanId, address indexed student, uint256 indexed bookId);

    /// @notice Se emite cuando el bibliotecario confirma la recogida
    /// @param loanId ID del prestamo
    /// @param librarian Direccion del bibliotecario que confirma
    /// @param dueDate Fecha limite de devolucion
    event LoanPickedUp(uint256 indexed loanId, address indexed librarian, uint40 dueDate);

    /// @notice Se emite al cerrar la devolucion de un prestamo
    /// @param loanId ID del prestamo devuelto
    /// @param student Direccion del estudiante
    /// @param bookId Libro devuelto
    /// @param overdue True si la devolucion fue fuera de plazo
    event LoanReturned(uint256 indexed loanId, address indexed student, uint256 indexed bookId, bool overdue);

    /// @notice Se emite al cancelar una solicitud de prestamo
    /// @param loanId ID del prestamo cancelado
    /// @param student Direccion del estudiante
    event LoanCancelled(uint256 indexed loanId, address indexed student);

    /// @notice Se emite al expirar una reserva no recogida
    /// @param loanId ID del prestamo expirado
    /// @param student Direccion del estudiante
    event ReservationExpired(uint256 indexed loanId, address indexed student);

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice Caller sin rol librarian/admin
    error NotLibrarian();
    /// @notice Caller sin rol student
    error NotStudent();
    /// @notice El libro no existe en el catalogo
    /// @param bookId ID del libro solicitado
    error BookNotFound(uint256 bookId);
    /// @notice El libro no esta disponible para nuevas reservas
    /// @param bookId ID del libro
    error BookNotAvailable(uint256 bookId);
    /// @notice El estudiante ya tiene un prestamo activo de ese libro
    /// @param student Direccion del estudiante
    /// @param bookId ID del libro
    error AlreadyBorrowingBook(address student, uint256 bookId);
    /// @notice El prestamo no existe
    /// @param loanId ID del prestamo solicitado
    error LoanNotFound(uint256 loanId);
    /// @notice El prestamo no esta en un estado valido para la operacion
    /// @param loanId ID del prestamo
    /// @param current Estado actual
    /// @param expected Estado esperado
    error InvalidLoanState(uint256 loanId, LoanStatus current, LoanStatus expected);
    /// @notice El estudiante no tiene saldo suficiente de LibraryToken para el deposito
    /// @param student Direccion del estudiante
    error InsufficientDeposit(address student);
    /// @notice El libro no se puede eliminar porque tiene prestamos o reservas activas
    /// @param bookId ID del libro
    error BookHasActiveLoans(uint256 bookId);
    /// @notice Transferencias ERC-1155 no permitidas fuera del contrato
    error TransferRestricted();
    /// @notice El caller no es el propietario del prestamo
    /// @param loanId ID del prestamo
    /// @param caller Direccion que intenta operar
    error NotLoanOwner(uint256 loanId, address caller);
    /// @notice El prestamo aun no esta vencido
    /// @param loanId ID del prestamo
    error LoanNotOverdue(uint256 loanId);
    /// @notice El numero de copias debe ser mayor que cero
    error ZeroCopies();
    /// @notice Caller sin rol admin
    error NotAdmin();
    /// @notice La reserva aun no ha superado el timeout de recogida
    /// @param loanId ID del prestamo
    error ReservationNotExpired(uint256 loanId);
    /// @notice El prestamo no esta en estado Queued ni Reserved
    /// @param loanId ID del prestamo
    error NotQueuedOrReserved(uint256 loanId);

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

    // ── Functions ───────────────────────────────────────────────────────

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Inicializa la biblioteca con sus dependencias
    /// @param _campusRoles Direccion del contrato CampusRoles
    /// @param _libraryToken Direccion del contrato LibraryToken (deposito)
    /// @param uri_ URI base para los metadatos ERC-1155
    constructor(
        address _campusRoles,
        address _libraryToken,
        string memory uri_
    ) ERC1155(uri_) {
        campusRoles = CampusRoles(_campusRoles);
        libraryToken = LibraryToken(_libraryToken);
    }

    // ── External functions ──────────────────────────────────────────────

    // ── Book management ─────────────────────────────────────────────────

    /// @notice Anade un nuevo libro al catalogo
    /// @dev Mintea N copias ERC-1155 al contrato como custodia
    /// @param copies Numero de copias iniciales (> 0)
    /// @return bookId ID asignado al nuevo libro
    function addBook(
        uint256 copies
    ) external onlyLibrarian whenNotPaused returns (uint256 bookId) {
        if (copies == 0) revert ZeroCopies();

        bookId = nextBookId;
        unchecked { ++nextBookId; }

        _books[bookId] = Book({
            totalCopies: copies,
            exists: true
        });

        _mint(address(this), bookId, copies, "");

        emit BookAdded(bookId, copies);
    }

    /// @notice Anade copias adicionales de un libro existente
    /// @dev Tras mintear, procesa la cola por si hay estudiantes esperando
    /// @param bookId ID del libro
    /// @param amount Copias adicionales a anadir (> 0)
    function addCopies(uint256 bookId, uint256 amount) external onlyLibrarian whenNotPaused {
        if (!_books[bookId].exists) revert BookNotFound(bookId);
        if (amount == 0) revert ZeroCopies();

        _books[bookId].totalCopies += amount;
        _mint(address(this), bookId, amount, "");

        emit BookCopiesAdded(bookId, amount);

        // Nuevas copias disponibles → procesar cola
        _processQueue(bookId);
    }

    /// @notice Desactiva un libro y quema las copias custodiadas
    /// @dev Requiere que no haya prestamos activos ni reservas
    /// @param bookId ID del libro
    function removeBook(uint256 bookId) external onlyLibrarian whenNotPaused {
        if (!_books[bookId].exists) revert BookNotFound(bookId);
        if (activeLoansForBook[bookId] > 0 || reservedCopiesForBook[bookId] > 0)
            revert BookHasActiveLoans(bookId);

        _books[bookId].exists = false;

        uint256 contractBalance = balanceOf(address(this), bookId);
        if (contractBalance > 0) {
            _burn(address(this), bookId, contractBalance);
        }

        emit BookRemoved(bookId);
    }

    // ── Loan flow ───────────────────────────────────────────────────────

    /// @notice Solicita un prestamo de un libro
    /// @dev Si hay copias libres -> RESERVED (reserva inmediata).
    ///      Si no hay copias -> QUEUED (entra en cola de espera).
    ///      En ambos casos bloquea 1 LibraryToken como deposito.
    /// @param bookId ID del libro solicitado
    /// @return loanId ID del prestamo creado
    function requestLoan(uint256 bookId) external onlyStudent whenNotPaused nonReentrant returns (uint256 loanId) {
        if (!_books[bookId].exists) revert BookNotFound(bookId);
        if (activeLoanByStudentAndBook[msg.sender][bookId] != 0)
            revert AlreadyBorrowingBook(msg.sender, bookId);
        if (libraryToken.balanceOf(msg.sender) < DEPOSIT_PER_LOAN)
            revert InsufficientDeposit(msg.sender);

        loanId = nextLoanId;
        unchecked { ++nextLoanId; }

        uint256 available = balanceOf(address(this), bookId) - reservedCopiesForBook[bookId];
        bool queued = available == 0;

        // --- Effects ---
        _loans[loanId] = Loan({
            bookId: bookId,
            student: msg.sender,
            status: queued ? LoanStatus.Queued : LoanStatus.Reserved,
            requestDate: uint40(block.timestamp),
            reservationDate: queued ? 0 : uint40(block.timestamp),
            pickupDate: 0,
            dueDate: 0,
            returnDate: 0
        });

        _studentLoanIds[msg.sender].push(loanId);
        activeLoanByStudentAndBook[msg.sender][bookId] = loanId;

        if (queued) {
            _bookQueue[bookId].push(loanId);
        } else {
            reservedCopiesForBook[bookId] += 1;
        }

        // --- Interactions ---
        libraryToken.transferFrom(msg.sender, address(this), DEPOSIT_PER_LOAN);

        emit LoanRequested(loanId, msg.sender, bookId, queued);
        if (!queued) {
            emit LoanReserved(loanId, msg.sender, bookId);
        }
    }

    /// @notice El estudiante cancela su solicitud (Queued o Reserved)
    /// @dev Devuelve el deposito. Si era Reserved, procesa la cola.
    /// @param loanId ID del prestamo a cancelar
    function cancelLoan(uint256 loanId) external onlyStudent whenNotPaused nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.student != msg.sender) revert NotLoanOwner(loanId, msg.sender);
        if (loan.status != LoanStatus.Queued && loan.status != LoanStatus.Reserved)
            revert NotQueuedOrReserved(loanId);

        uint256 bookId = loan.bookId;
        bool wasReserved = loan.status == LoanStatus.Reserved;

        // --- Effects ---
        loan.status = LoanStatus.Cancelled;
        activeLoanByStudentAndBook[msg.sender][bookId] = 0;

        if (wasReserved) {
            reservedCopiesForBook[bookId] -= 1;
        }

        // --- Interactions ---
        libraryToken.transfer(msg.sender, DEPOSIT_PER_LOAN);

        emit LoanCancelled(loanId, msg.sender);

        // Si era reservado, la copia queda libre → siguiente en cola
        if (wasReserved) {
            _processQueue(bookId);
        }
    }

    /// @notice El bibliotecario confirma que el estudiante ha recogido el item
    /// @dev Transfiere la copia ERC-1155 al estudiante y arranca el plazo de devolucion
    /// @param loanId ID del prestamo
    function confirmPickup(uint256 loanId) external onlyLibrarian whenNotPaused nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.Reserved)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.Reserved);

        uint256 bookId = loan.bookId;
        address student = loan.student;

        // --- Effects ---
        loan.status = LoanStatus.PickedUp;
        loan.pickupDate = uint40(block.timestamp);
        loan.dueDate = uint40(block.timestamp + DEFAULT_LOAN_DURATION);
        reservedCopiesForBook[bookId] -= 1;
        activeLoansForBook[bookId] += 1;

        // --- Interactions ---
        _safeTransferFrom(address(this), student, bookId, 1, "");

        emit LoanPickedUp(loanId, msg.sender, loan.dueDate);
    }

    /// @notice El bibliotecario confirma la devolucion fisica del libro
    /// @dev Recupera el NFT, devuelve deposito y procesa la cola
    /// @param loanId ID del prestamo
    function confirmReturn(uint256 loanId) external onlyLibrarian whenNotPaused nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.PickedUp)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.PickedUp);

        uint256 bookId = loan.bookId;
        address student = loan.student;
        bool overdue = block.timestamp > loan.dueDate;

        // --- Effects ---
        loan.status = LoanStatus.Returned;
        loan.returnDate = uint40(block.timestamp);
        activeLoanByStudentAndBook[student][bookId] = 0;
        activeLoansForBook[bookId] -= 1;

        // --- Interactions ---
        _safeTransferFrom(student, address(this), bookId, 1, "");
        libraryToken.transfer(student, DEPOSIT_PER_LOAN);

        emit LoanReturned(loanId, student, bookId, overdue);

        // Copia disponible → siguiente en cola
        _processQueue(bookId);
    }

    /// @notice El bibliotecario fuerza la devolucion de un prestamo vencido
    /// @dev El deposito NO se devuelve (penalizacion). Procesa la cola.
    /// @param loanId ID del prestamo
    function forceReturn(uint256 loanId) external onlyLibrarian whenNotPaused nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.PickedUp)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.PickedUp);
        if (block.timestamp <= loan.dueDate) revert LoanNotOverdue(loanId);

        uint256 bookId = loan.bookId;
        address student = loan.student;

        // --- Effects ---
        loan.status = LoanStatus.Returned;
        loan.returnDate = uint40(block.timestamp);
        activeLoanByStudentAndBook[student][bookId] = 0;
        activeLoansForBook[bookId] -= 1;

        // --- Interactions ---
        _safeTransferFrom(student, address(this), bookId, 1, "");
        // Deposito NO devuelto (penalizacion)

        emit LoanReturned(loanId, student, bookId, true);

        _processQueue(bookId);
    }

    /// @notice El bibliotecario expira una reserva no recogida tras RESERVATION_TIMEOUT
    /// @dev Devuelve el deposito y procesa la cola
    /// @param loanId ID del prestamo
    function expireReservation(uint256 loanId) external onlyLibrarian whenNotPaused nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.Reserved)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.Reserved);
        if (block.timestamp <= loan.reservationDate + RESERVATION_TIMEOUT)
            revert ReservationNotExpired(loanId);

        uint256 bookId = loan.bookId;
        address student = loan.student;

        // --- Effects ---
        loan.status = LoanStatus.Cancelled;
        activeLoanByStudentAndBook[student][bookId] = 0;
        reservedCopiesForBook[bookId] -= 1;

        // --- Interactions ---
        libraryToken.transfer(student, DEPOSIT_PER_LOAN);

        emit ReservationExpired(loanId, student);

        _processQueue(bookId);
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

    /// @notice Copias disponibles para nuevas reservas
    /// @dev = copias en contrato - copias ya reservadas (pendientes de recogida)
    /// @param bookId ID del libro
    /// @return Copias disponibles
    function getAvailableCopies(uint256 bookId) external view returns (uint256) {
        uint256 held = balanceOf(address(this), bookId);
        uint256 reserved = reservedCopiesForBook[bookId];
        return held > reserved ? held - reserved : 0;
    }

    /// @notice Devuelve copias totales, disponibles y existencia de un libro
    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getBookInfo(uint256 bookId) external view returns (
        uint256 totalCopies,
        uint256 availableCopies,
        bool exists_
    ) {
        Book storage book = _books[bookId];
        uint256 held = balanceOf(address(this), bookId);
        uint256 reserved = reservedCopiesForBook[bookId];
        return (
            book.totalCopies,
            held > reserved ? held - reserved : 0,
            book.exists
        );
    }

    /// @notice Devuelve los datos completos de un prestamo
    function getLoanInfo(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    /// @notice Devuelve el array historico de IDs de prestamos de un estudiante
    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getStudentLoans(address student) external view returns (uint256[] memory) {
        return _studentLoanIds[student];
    }

    /// @notice Comprueba si un prestamo recogido ha superado la fecha limite
    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function isOverdue(uint256 loanId) external view returns (bool) {
        Loan storage loan = _loans[loanId];
        return loan.status == LoanStatus.PickedUp && block.timestamp > loan.dueDate;
    }

    /// @notice Comprueba si una reserva ha superado el timeout de recogida
    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function isReservationExpired(uint256 loanId) external view returns (bool) {
        Loan storage loan = _loans[loanId];
        return loan.status == LoanStatus.Reserved &&
               block.timestamp > loan.reservationDate + RESERVATION_TIMEOUT;
    }

    /// @notice Devuelve la posicion en la cola de espera de un prestamo (1-indexed, 0 si no esta en cola)
    function getQueuePosition(uint256 loanId) external view returns (uint256 position) {
        Loan storage loan = _loans[loanId];
        if (loan.status != LoanStatus.Queued) return 0;

        uint256[] storage queue = _bookQueue[loan.bookId];
        uint256 pos = 1;
        for (uint256 i = 0; i < queue.length; i++) {
            if (queue[i] == loanId) return pos;
            if (queue[i] != 0 && _loans[queue[i]].status == LoanStatus.Queued) pos++;
        }
        return 0;
    }

    /// @notice Devuelve cuantos prestamos hay en cola de espera para un libro
    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getQueueLength(uint256 bookId) external view returns (uint256 count) {
        uint256[] storage queue = _bookQueue[bookId];
        for (uint256 i = 0; i < queue.length; i++) {
            if (queue[i] != 0 && _loans[queue[i]].status == LoanStatus.Queued) count++;
        }
    }

    // ── Internal functions ───────────────────────────────────────────────

    /// @dev Procesa la cola de espera de un libro asignando copias disponibles
    ///      a los primeros en cola (FIFO).
    /// @param bookId ID del libro cuya cola debe procesarse
    function _processQueue(uint256 bookId) internal {
        uint256 held = balanceOf(address(this), bookId);
        uint256 reserved = reservedCopiesForBook[bookId];
        uint256 available = held > reserved ? held - reserved : 0;
        if (available == 0) return;

        uint256[] storage queue = _bookQueue[bookId];
        for (uint256 i = 0; i < queue.length && available > 0; i++) {
            uint256 queuedLoanId = queue[i];
            if (queuedLoanId == 0) continue;

            Loan storage loan = _loans[queuedLoanId];
            if (loan.status != LoanStatus.Queued) continue;

            loan.status = LoanStatus.Reserved;
            loan.reservationDate = uint40(block.timestamp);
            reservedCopiesForBook[bookId] += 1;
            available--;

            queue[i] = 0; // marcar slot como procesado

            emit LoanReserved(queuedLoanId, loan.student, bookId);
        }
    }

    /// @dev OZ v5: _update reemplaza a _beforeTokenTransfer.
    ///      Bloquea transferencias entre direcciones externas (las copias solo
    ///      se mueven entre el contrato y el estudiante en flujos controlados).
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        if (from != address(0) && to != address(0)) {
            if (from != address(this) && to != address(this)) {
                revert TransferRestricted();
            }
        }
        super._update(from, to, ids, values);
    }

    /// @inheritdoc ERC1155
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC1155, ERC1155Holder) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}