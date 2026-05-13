// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { CampusRoles } from "./CampusRoles.sol";

/// @title LibraryToken
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Token ERC-20 de capacidad de prestamo bibliotecario
/// @dev 1 token equivale a 1 slot de prestamo simultaneo.
contract LibraryToken is ERC20, Pausable {
    // ── State variables ─────────────────────────────────────────────────

    /// @notice Referencia al control de acceso del campus
    CampusRoles public immutable campusRoles;

    /// @notice Tokens iniciales recomendados por estudiante
    uint256 public constant INITIAL_TOKENS = 10;

    /// @notice Contrato autorizado para gastar sin approve individual
    address public trustedSpender;

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice Caller sin rol admin
    error NotAdmin();
    /// @notice Direccion cero no permitida
    error ZeroAddress();
    /// @notice Cantidad cero no permitida
    error ZeroAmount();

    // ── Modifiers ───────────────────────────────────────────────────────

    /// @notice Restringe la ejecucion a admins del sistema
    modifier onlyAdmin() {
        if (!campusRoles.isAdmin(msg.sender)) {
            revert NotAdmin();
        }
        _;
    }

    // ── Functions ───────────────────────────────────────────────────────

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Inicializa el token y su referencia de control de acceso
    /// @param _campusRoles Direccion del contrato CampusRoles
    constructor(address _campusRoles) ERC20("LibraryToken", "LIBT") {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── External functions ──────────────────────────────────────────────

    /// @notice Configura el spender de confianza
    /// @dev Debe apuntar al contrato LibraryManager
    /// @param spender Direccion del spender autorizado
    function setTrustedSpender(address spender) external onlyAdmin whenNotPaused {
        if (spender == address(0)) {
            revert ZeroAddress();
        }
        trustedSpender = spender;
    }

    /// @notice Mintea tokens de capacidad de prestamo
    /// @param to Cuenta receptora
    /// @param amount Cantidad a mintear
    function mint(address to, uint256 amount) external onlyAdmin whenNotPaused {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        _mint(to, amount);
    }

    /// @notice Quema tokens de una cuenta
    /// @param from Cuenta de origen
    /// @param amount Cantidad a quemar
    function burn(address from, uint256 amount) external onlyAdmin whenNotPaused {
        if (from == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        _burn(from, amount);
    }

    /// @notice Pausa el contrato (solo admin)
    function pause() external onlyAdmin {
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ── Public view functions ───────────────────────────────────────────

    /// @notice Consulta allowance entre owner y spender
    /// @dev Si spender es trustedSpender retorna allowance infinito
    /// @param owner Cuenta duena de fondos
    /// @param spender Cuenta que intenta gastar
    /// @return Cantidad permitida
    function allowance(address owner, address spender) public view override returns (uint256) {
        if (spender == trustedSpender && trustedSpender != address(0)) {
            return type(uint256).max;
        }
        return super.allowance(owner, spender);
    }

    // ── Public pure functions ───────────────────────────────────────────

    /// @notice Decimales del token
    /// @dev Se usa 0 para manejar unidades enteras
    /// @return Cantidad de decimales
    function decimals() public pure override returns (uint8) {
        return 0;
    }
}
