// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { CampusRoles } from "./CampusRoles.sol";

/// @title Printer
/// @author CryptoCampus Team
/// @notice Contrato para gestionar creditos de impresion de estudiantes.
/// @dev 1 credito = 1 pagina. Cada estudiante inicia con creditos por defecto.
contract Printer is Pausable {

    // ── State variables ─────────────────────────────────────────────────

    /// @notice Referencia al contrato de control de acceso del campus
    CampusRoles public immutable campusRoles;

    /// @notice Creditos iniciales para estudiantes
    uint256 public constant INITIAL_CREDITS = 200;

    /// @dev Creditos configurados por estudiante
    mapping(address => uint256) private _credits;

    /// @dev Indica si el estudiante ya fue configurado por un admin
    mapping(address => bool) private _modified;

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Se emite cuando un admin fija creditos para un estudiante
    /// @param student Direccion del estudiante
    /// @param credits Nueva cantidad de creditos asignada
    event CreditsSet(address indexed student, uint256 credits);

    /// @notice Se emite cuando se ejecuta una impresion
    /// @param student Direccion del estudiante
    /// @param pages Cantidad de paginas impresas
    /// @param remainingCredits Creditos restantes luego de imprimir
    event PrintJobExecuted(address indexed student, uint256 pages, uint256 remainingCredits);

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice El caller no tiene rol de administrador
    error NotAdmin();

    /// @notice La direccion no pertenece a un estudiante
    /// @param user Direccion que no es estudiante
    error NotStudent(address user);

    /// @notice El estudiante no tiene creditos suficientes
    /// @param available Creditos disponibles
    /// @param requested Creditos requeridos
    error InsufficientCredits(uint256 available, uint256 requested);

    /// @notice La cantidad de paginas debe ser mayor que cero
    error ZeroPages();

    /// @notice La direccion proporcionada no puede ser la direccion cero
    error ZeroAddress();

    // ── Modifiers ───────────────────────────────────────────────────────

    /// @notice Restringe la ejecucion a administradores del sistema
    modifier onlyAdmin() {
        if (!campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender)) {
            revert NotAdmin();
        }
        _;
    }

    // ── Functions ───────────────────────────────────────────────────────

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Inicializa el contrato con el control de acceso del campus
    /// @param _campusRoles Direccion del contrato CampusRoles
    constructor(address _campusRoles) {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── External functions ──────────────────────────────────────────────

    /// @notice Establece directamente los creditos de un estudiante
    /// @dev Permite tanto anadir como quitar creditos
    /// @param student Direccion del estudiante
    /// @param credits Nueva cantidad de creditos
    function setCredits(address student, uint256 credits) external onlyAdmin whenNotPaused {
        if (student == address(0)) {
            revert ZeroAddress();
        }
        if (!campusRoles.isStudent(student)) {
            revert NotStudent(student);
        }

        _credits[student] = credits;
        _modified[student] = true;

        emit CreditsSet(student, credits);
    }

    /// @notice Ejecuta una impresion en nombre de un estudiante
    /// @dev Llamada por un admin para registrar consumo de paginas
    /// @param student Direccion del estudiante
    /// @param pages Cantidad de paginas a imprimir
    function print(address student, uint256 pages) external onlyAdmin whenNotPaused {
        if (student == address(0)) {
            revert ZeroAddress();
        }
        if (!campusRoles.isStudent(student)) {
            revert NotStudent(student);
        }
        if (pages == 0) {
            revert ZeroPages();
        }

        uint256 available = _modified[student] ? _credits[student] : INITIAL_CREDITS;
        if (available < pages) {
            revert InsufficientCredits(available, pages);
        }

        uint256 remaining;
        unchecked {
            remaining = available - pages;
        }

        _credits[student] = remaining;
        if (!_modified[student]) {
            _modified[student] = true;
        }

        emit PrintJobExecuted(student, pages, remaining);
    }

    // ── External view functions ─────────────────────────────────────────

    /// @notice Obtiene los creditos disponibles de un estudiante
    /// @dev Devuelve -1 si la direccion no pertenece a un estudiante
    /// @param student Direccion a consultar
    /// @return Creditos actuales o -1 si no es estudiante
    function getCredits(address student) external view returns (int256) {
        if (!campusRoles.isStudent(student)) {
            return -1;
        }
        return int256(_modified[student] ? _credits[student] : INITIAL_CREDITS);
    }

    // ── Pausable ─────────────────────────────────────────────────────────

    /// @notice Pausa el contrato (solo admin)
    function pause() external onlyAdmin {
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external onlyAdmin {
        _unpause();
    }
}
