// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { CampusRoles } from "./CampusRoles.sol";

/// @title Printer
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Contrato para gestionar creditos de impresion del campus.
/// @dev 1 credito = 1 pagina. Estudiantes y profesores usan creditos.
///      Admin y Librarian tienen creditos ilimitados. Max 50 paginas por trabajo.
contract Printer is Pausable {

    // ── State variables ─────────────────────────────────────────────────

    /// @notice Referencia al contrato de control de acceso del campus
    CampusRoles public immutable campusRoles;

    /// @notice Creditos iniciales para estudiantes y profesores
    uint256 public constant INITIAL_CREDITS = 200;

    /// @notice Maximo de paginas por trabajo de impresion
    uint256 public constant MAX_PAGES_PER_JOB = 50;

    /// @dev Creditos configurados por usuario
    mapping(address => uint256) private _credits;

    /// @dev Indica si el usuario ya fue configurado por un admin
    mapping(address => bool) private _modified;

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Se emite cuando un admin fija creditos para un estudiante o profesor
    /// @param user Direccion del usuario
    /// @param credits Creditos asignados
    event CreditsSet(address indexed user, uint256 credits);

    /// @notice Se emite cuando se ejecuta una impresion
    /// @param user Direccion del usuario que imprime
    /// @param pages Numero de paginas impresas
    /// @param remainingCredits Creditos restantes (type(uint256).max si ilimitado)
    event PrintJobExecuted(address indexed user, uint256 pages, uint256 remainingCredits);

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice Caller sin rol admin
    error NotAdmin();
    /// @notice El usuario no es estudiante ni profesor
    /// @param user Direccion del usuario
    error NotStudentOrProfessor(address user);
    /// @notice El usuario no esta registrado en CampusRoles
    /// @param user Direccion del usuario
    error NotRegistered(address user);
    /// @notice El usuario no tiene creditos suficientes
    /// @param available Creditos disponibles
    /// @param requested Creditos solicitados
    error InsufficientCredits(uint256 available, uint256 requested);
    /// @notice La impresion excede el maximo de paginas por trabajo
    /// @param requested Paginas solicitadas
    /// @param max Maximo permitido
    error ExceedsMaxPages(uint256 requested, uint256 max);
    /// @notice La impresion debe ser de al menos una pagina
    error ZeroPages();
    /// @notice Direccion cero no permitida
    error ZeroAddress();

    // ── Modifiers ───────────────────────────────────────────────────────

    /// @notice Restringe la ejecucion a admins del sistema
    modifier onlyAdmin() {
        if (!campusRoles.isAdmin(msg.sender)) {
            revert NotAdmin();
        }
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Inicializa el contrato con su referencia de control de acceso
    /// @param _campusRoles Direccion del contrato CampusRoles
    constructor(address _campusRoles) {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── External functions ──────────────────────────────────────────────

    /// @notice Establece directamente los creditos de un estudiante o profesor
    /// @param user Direccion del estudiante o profesor
    /// @param credits Nueva cantidad de creditos
    function setCredits(address user, uint256 credits) external onlyAdmin whenNotPaused {
        if (user == address(0)) revert ZeroAddress();
        if (!campusRoles.isStudent(user) && !campusRoles.isProfessor(user)) {
            revert NotStudentOrProfessor(user);
        }

        _credits[user] = credits;
        _modified[user] = true;

        emit CreditsSet(user, credits);
    }

    /// @notice Ejecuta una impresion en nombre de un usuario
    /// @dev Admin y Librarian no gastan creditos. Max 50 paginas por trabajo.
    /// @param user Direccion del usuario que imprime
    /// @param pages Cantidad de paginas a imprimir
    function print(address user, uint256 pages) external onlyAdmin whenNotPaused {
        if (user == address(0)) revert ZeroAddress();
        if (pages == 0) revert ZeroPages();
        if (pages > MAX_PAGES_PER_JOB) revert ExceedsMaxPages(pages, MAX_PAGES_PER_JOB);

        // Admin y Librarian: creditos ilimitados
        bool unlimited = campusRoles.isAdmin(user) ||
                         campusRoles.isLibrarian(user);

        if (unlimited) {
            emit PrintJobExecuted(user, pages, type(uint256).max);
        } else {
            // Estudiantes y profesores: sistema de creditos
            if (!campusRoles.isRegistered(user)) revert NotRegistered(user);

            uint256 available = _modified[user] ? _credits[user] : INITIAL_CREDITS;
            if (available < pages) revert InsufficientCredits(available, pages);

            uint256 remaining;
            unchecked { remaining = available - pages; }

            _credits[user] = remaining;
            if (!_modified[user]) _modified[user] = true;

            emit PrintJobExecuted(user, pages, remaining);
        }
    }

    /// @notice Pausa el contrato (solo admin)
    function pause() external onlyAdmin {
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ── External view functions ─────────────────────────────────────────

    /// @notice Obtiene los creditos disponibles de un usuario
    /// @dev Admin/Librarian devuelven max. No registrados devuelven -1.
    function getCredits(address user) external view returns (int256) {
        // Admin y Librarian: ilimitados
        if (campusRoles.isAdmin(user) || campusRoles.isLibrarian(user)) {
            return type(int256).max;
        }
        // Usuarios no registrados
        if (!campusRoles.isRegistered(user)) return -1;
        // Estudiantes y profesores
        return int256(_modified[user] ? _credits[user] : INITIAL_CREDITS);
    }
}
