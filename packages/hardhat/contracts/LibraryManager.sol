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
/// @author CryptoCampus Team
/// @notice Gestiona catalogo de libros y flujo de prestamos
/// @dev Cada token ID representa un titulo; el contrato custodia copias disponibles.
contract LibraryManager is ERC1155, ERC1155Supply, ERC1155Holder, ReentrancyGuard, Pausable {
    // ── Type declarations ───────────────────────────────────────────────

    /// @notice Referencia al control de acceso del campus
    CampusRoles public immutable campusRoles;

    /// @notice Token de deposito para prestamos
    LibraryToken public immutable libraryToken;

    /// @notice Duracion por defecto de un prestamo aprobado
    uint256 public constant DEFAULT_LOAN_DURATION = 21 days;

    /// @notice Deposito en token requerido por prestamo
    uint256 public constant DEPOSIT_PER_LOAN = 1;

    // Titulo, autor, isbn y demas metadatos se guardan en Prisma vinculados por tokenId.
    // En la blockchain solo guardamos lo necesario para la logica de prestamos.
    struct Book {
        uint256 totalCopies;
        bool exists;
    }

    /// @notice Estados posibles de un prestamo
    enum LoanStatus { None, Requested, Approved, Rejected, Returned }

    struct Loan {
        uint256 bookId;
        address student;
        LoanStatus status;
        uint40 requestDate;
        uint40 approvalDate;
        uint40 dueDate;
        uint40 returnDate;
    }

    // ── State variables ─────────────────────────────────────────────────
    uint256 public nextBookId = 1;
    mapping(uint256 => Book) private _books;

    uint256 public nextLoanId = 1;
    mapping(uint256 => Loan) private _loans;

    // student => bookId => active loanId (0 = no active loan)
    mapping(address => mapping(uint256 => uint256)) public activeLoanByStudentAndBook;
    // student => array of all loan IDs (historical)
    mapping(address => uint256[]) private _studentLoanIds;
    // bookId => count of active loans
    mapping(uint256 => uint256) public activeLoansForBook;

    // ── Errors ──────────────────────────────────────────────────────────
    error NotLibrarian();
    error NotStudent();
    error BookNotFound(uint256 bookId);
    error BookNotAvailable(uint256 bookId);
    error BookAlreadyExists(uint256 bookId);
    error AlreadyBorrowingBook(address student, uint256 bookId);
    error LoanNotFound(uint256 loanId);
    error InvalidLoanState(uint256 loanId, LoanStatus current, LoanStatus expected);
    error InsufficientDeposit(address student);
    error BookHasActiveLoans(uint256 bookId);
    error TransferRestricted();
    error NotLoanOwner(uint256 loanId, address caller);
    error LoanNotOverdue(uint256 loanId);
    error ZeroCopies();
    error NotAdmin();

    // ── Events ──────────────────────────────────────────────────────────
    event BookAdded(uint256 indexed bookId, uint256 copies);
    event BookCopiesAdded(uint256 indexed bookId, uint256 additionalCopies);
    event BookRemoved(uint256 indexed bookId);
    event LoanRequested(uint256 indexed loanId, address indexed student, uint256 indexed bookId);
    event LoanApproved(uint256 indexed loanId, address indexed librarian, uint40 dueDate);
    event LoanRejected(uint256 indexed loanId, address indexed librarian, string reason);
    event LoanReturned(uint256 indexed loanId, address indexed student, uint256 indexed bookId, bool overdue);
    event LoanRequestCancelled(uint256 indexed loanId);
    event LoanForceReturned(uint256 indexed loanId, address indexed librarian);

    // ── Modifiers ───────────────────────────────────────────────────────

    constructor(
        address _campusRoles,
        address _libraryToken,
        string memory uri_
    ) ERC1155(uri_) {
        campusRoles = CampusRoles(_campusRoles);
        libraryToken = LibraryToken(_libraryToken);
    }

    modifier onlyLibrarian() {
        if (!campusRoles.hasRole(campusRoles.LIBRARIAN_ROLE(), msg.sender))
            revert NotLibrarian();
        _;
    }

    modifier onlyStudent() {
        if (!campusRoles.hasRole(campusRoles.STUDENT_ROLE(), msg.sender))
            revert NotStudent();
        _;
    }

    // ── Functions ───────────────────────────────────────────────────────

    // ── External functions ──────────────────────────────────────────────

    // ── Book management ─────────────────────────────────────────────────

    /**
     * @dev Anade un nuevo libro al catalogo. Mintea N copias ERC-1155 al contrato.
     */
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

        // Mintear copias al propio contrato (custodio)
        _mint(address(this), bookId, copies, "");

        emit BookAdded(bookId, copies);
    }

    /**
     * @dev Anade copias adicionales de un libro existente.
     */
    function addCopies(uint256 bookId, uint256 amount) external onlyLibrarian whenNotPaused {
        if (!_books[bookId].exists) revert BookNotFound(bookId);
        if (amount == 0) revert ZeroCopies();

        _books[bookId].totalCopies += amount;
        _mint(address(this), bookId, amount, "");

        emit BookCopiesAdded(bookId, amount);
    }

    /**
     * @dev Desactiva un libro y quema las copias del contrato.
     *      Requiere que no haya prestamos activos.
     */
    function removeBook(uint256 bookId) external onlyLibrarian {
        if (!_books[bookId].exists) revert BookNotFound(bookId);
        if (activeLoansForBook[bookId] > 0) revert BookHasActiveLoans(bookId);

        _books[bookId].exists = false;

        // Quemar todas las copias que tiene el contrato
        uint256 contractBalance = balanceOf(address(this), bookId);
        if (contractBalance > 0) {
            _burn(address(this), bookId, contractBalance);
        }

        emit BookRemoved(bookId);
    }

    /**
     * @dev Copias disponibles para prestamo (las que tiene el contrato).
     */
    function getAvailableCopies(uint256 bookId) external view returns (uint256) {
        return balanceOf(address(this), bookId);
    }

    // ── Loan flow ───────────────────────────────────────────────────────

    /**
     * @dev Estudiante solicita prestamo de un libro.
     *      No bloquea tokens todavia (eso se hace al aprobar).
     */
    function requestLoan(uint256 bookId) external onlyStudent whenNotPaused returns (uint256 loanId) {
        if (!_books[bookId].exists) revert BookNotFound(bookId);
        if (balanceOf(address(this), bookId) == 0) revert BookNotAvailable(bookId);
        if (activeLoanByStudentAndBook[msg.sender][bookId] != 0)
            revert AlreadyBorrowingBook(msg.sender, bookId);

        loanId = nextLoanId;
        unchecked { ++nextLoanId; }

        _loans[loanId] = Loan({
            bookId: bookId,
            student: msg.sender,
            status: LoanStatus.Requested,
            requestDate: uint40(block.timestamp),
            approvalDate: 0,
            dueDate: 0,
            returnDate: 0
        });

        _studentLoanIds[msg.sender].push(loanId);

        emit LoanRequested(loanId, msg.sender, bookId);
    }

    /**
     * @dev Estudiante cancela su propia solicitud pendiente.
     */
    function cancelLoanRequest(uint256 loanId) external onlyStudent {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.student != msg.sender) revert NotLoanOwner(loanId, msg.sender);
        if (loan.status != LoanStatus.Requested)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.Requested);

        loan.status = LoanStatus.Rejected; // Reutilizamos Rejected para cancelaciones

        emit LoanRequestCancelled(loanId);
    }

    /**
     * @dev Bibliotecario aprueba un prestamo.
     *      Bloquea 1 LibraryToken del estudiante y transfiere 1 copia del libro.
     */
    function approveLoan(uint256 loanId) external onlyLibrarian whenNotPaused nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.Requested)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.Requested);

        uint256 bookId = loan.bookId;
        address student = loan.student;

        // Verificar que aun hay copias disponibles
        if (balanceOf(address(this), bookId) == 0) revert BookNotAvailable(bookId);

        // Verificar que el estudiante tiene suficientes LibraryTokens
        if (libraryToken.balanceOf(student) < DEPOSIT_PER_LOAN)
            revert InsufficientDeposit(student);

        // Verificar allowance
        if (libraryToken.allowance(student, address(this)) < DEPOSIT_PER_LOAN)
            revert InsufficientDeposit(student);

        // --- Effects ---
        loan.status = LoanStatus.Approved;
        loan.approvalDate = uint40(block.timestamp);
        loan.dueDate = uint40(block.timestamp + DEFAULT_LOAN_DURATION);
        activeLoanByStudentAndBook[student][bookId] = loanId;
        activeLoansForBook[bookId] += 1;

        // --- Interactions ---
        // 1. Bloquear deposito (transferir LibraryToken del estudiante al contrato)
        libraryToken.transferFrom(student, address(this), DEPOSIT_PER_LOAN);

        // 2. Transferir libro al estudiante
        _safeTransferFrom(address(this), student, bookId, 1, "");

        emit LoanApproved(loanId, msg.sender, loan.dueDate);
    }

    /**
     * @dev Bibliotecario rechaza una solicitud de prestamo.
     */
    function rejectLoan(uint256 loanId, string calldata reason) external onlyLibrarian {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.Requested)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.Requested);

        loan.status = LoanStatus.Rejected;

        emit LoanRejected(loanId, msg.sender, reason);
    }

    /**
     * @dev Bibliotecario confirma la devolucion fisica del libro.
     *      Recupera el NFT del estudiante y devuelve el deposito.
     */
    function confirmReturn(uint256 loanId) external onlyLibrarian whenNotPaused nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.Approved)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.Approved);

        uint256 bookId = loan.bookId;
        address student = loan.student;
        bool overdue = block.timestamp > loan.dueDate;

        // --- Effects ---
        loan.status = LoanStatus.Returned;
        loan.returnDate = uint40(block.timestamp);
        activeLoanByStudentAndBook[student][bookId] = 0;
        activeLoansForBook[bookId] -= 1;

        // --- Interactions ---
        // 1. Recuperar libro del estudiante (internal transfer, no requiere approval)
        _safeTransferFrom(student, address(this), bookId, 1, "");

        // 2. Devolver deposito al estudiante
        libraryToken.transfer(student, DEPOSIT_PER_LOAN);

        emit LoanReturned(loanId, student, bookId, overdue);
    }

    /**
     * @dev Bibliotecario fuerza la devolucion de un libro atrasado.
     *      El deposito NO se devuelve (penalizacion).
     */
    function forceReturn(uint256 loanId) external onlyLibrarian whenNotPaused nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.status == LoanStatus.None) revert LoanNotFound(loanId);
        if (loan.status != LoanStatus.Approved)
            revert InvalidLoanState(loanId, loan.status, LoanStatus.Approved);
        if (block.timestamp <= loan.dueDate) revert LoanNotOverdue(loanId);

        uint256 bookId = loan.bookId;
        address student = loan.student;

        // --- Effects ---
        loan.status = LoanStatus.Returned;
        loan.returnDate = uint40(block.timestamp);
        activeLoanByStudentAndBook[student][bookId] = 0;
        activeLoansForBook[bookId] -= 1;

        // --- Interactions ---
        // Recuperar libro (deposito NO devuelto como penalizacion)
        _safeTransferFrom(student, address(this), bookId, 1, "");

        emit LoanForceReturned(loanId, msg.sender);
    }

    // ── Pausable ─────────────────────────────────────────────────────────

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

    function getBookInfo(uint256 bookId) external view returns (
        uint256 totalCopies,
        uint256 availableCopies,
        bool exists_
    ) {
        Book storage book = _books[bookId];
        return (
            book.totalCopies,
            balanceOf(address(this), bookId),
            book.exists
        );
    }

    function getLoanInfo(uint256 loanId) external view returns (Loan memory) {
        return _loans[loanId];
    }

    function getStudentLoans(address student) external view returns (uint256[] memory) {
        return _studentLoanIds[student];
    }

    function isOverdue(uint256 loanId) external view returns (bool) {
        Loan storage loan = _loans[loanId];
        return loan.status == LoanStatus.Approved && block.timestamp > loan.dueDate;
    }

    // ── Public view functions ───────────────────────────────────────────

    /**
     * @dev Restriccion de transferencias: solo se permiten operaciones donde
     *      el contrato es parte (prestamos/devoluciones) o mint/burn.
     *      OZ v5: _update reemplaza a _beforeTokenTransfer (firma sin operator ni data).
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        // Permitir mint (from == 0) y burn (to == 0)
        if (from != address(0) && to != address(0)) {
            // Solo permitir si el contrato es parte de la transferencia
            if (from != address(this) && to != address(this)) {
                revert TransferRestricted();
            }
        }
        super._update(from, to, ids, values);
    }

    /**
     * @dev Resolucion de conflicto de supportsInterface.
     *      OZ v5: ERC1155Receiver fue eliminado, se usa ERC1155Holder directamente.
     */
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC1155, ERC1155Holder) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
