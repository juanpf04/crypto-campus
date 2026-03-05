// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CampusAccessControl.sol";

/**
 * @title PrintingService
 * @dev Gestion de creditos de impresion usando mapping simple (sin ERC-20).
 *      1 credito = 1 pagina. Todo estudiante tiene 200 creditos automaticamente.
 *      El admin puede editar directamente los creditos de un estudiante con setCredits.
 */
contract PrintingService {

    CampusAccessControl public immutable accessControl;

    uint256 public constant INITIAL_CREDITS = 200;

    mapping(address => uint256) private _credits;
    mapping(address => bool) private _modified;

    // --- Custom Errors ---
    error NotAdmin();
    error NotStudent(address user);
    error InsufficientCredits(uint256 available, uint256 requested);
    error ZeroPages();
    error ZeroAddress();

    // --- Events ---
    event CreditsSet(address indexed student, uint256 newAmount);
    event PrintJobExecuted(
        address indexed student,
        uint256 pages,
        uint256 remainingCredits
    );

    constructor(address _accessControl) {
        accessControl = CampusAccessControl(_accessControl);
    }

    // --- Modifiers ---
    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender))
            revert NotAdmin();
        _;
    }

    // --- Functions ---

    /**
     * @dev Establece directamente los creditos de un estudiante.
     *      Permite tanto anadir como quitar creditos.
     */
    function setCredits(address student, uint256 amount) external onlyAdmin {
        if (student == address(0)) revert ZeroAddress();
        if (!accessControl.isStudent(student)) revert NotStudent(student);

        _credits[student] = amount;
        _modified[student] = true;

        emit CreditsSet(student, amount);
    }

    /**
     * @dev Ejecuta una impresion. Decrementa creditos y emite evento.
     *      Llamada por el backend Flask (admin) en nombre del estudiante.
     *      El tx.hash sirve como referencia para vincular con la BBDD.
     */
    function print(address student, uint256 pages) external onlyAdmin {
        if (student == address(0)) revert ZeroAddress();
        if (!accessControl.isStudent(student)) revert NotStudent(student);
        if (pages == 0) revert ZeroPages();

        uint256 available = _modified[student] ? _credits[student] : INITIAL_CREDITS;
        if (available < pages) revert InsufficientCredits(available, pages);

        uint256 remaining;
        unchecked {
            remaining = available - pages;
        }

        _credits[student] = remaining;
        if (!_modified[student]) _modified[student] = true;

        emit PrintJobExecuted(student, pages, remaining);
    }

    // --- View Functions ---

    /**
     * @dev Devuelve los creditos disponibles de un estudiante.
     *      Devuelve -1 si el address no es estudiante.
     */
    function getCredits(address student) external view returns (int256) {
        if (!accessControl.isStudent(student)) return -1;
        return int256(_modified[student] ? _credits[student] : INITIAL_CREDITS);
    }
}
