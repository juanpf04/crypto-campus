// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { CampusRoles } from "./CampusRoles.sol";

/// @title LibraryToken
/// @author CryptoCampus Team
/// @notice Token ERC-20 de capacidad de prestamo bibliotecario
/// @dev 1 token equivale a 1 slot de prestamo simultaneo.
contract LibraryToken is ERC20 {
    // ── State variables ─────────────────────────────────────────────────

    /// @notice Referencia al control de acceso del campus
    CampusRoles public immutable campusRoles;

    /// @notice Tokens iniciales recomendados por estudiante
    uint256 public constant INITIAL_TOKENS = 10;

    /// @notice Contrato autorizado para gastar sin approve individual
    address public trustedSpender;

    // ── Errors ──────────────────────────────────────────────────────────

    error NotAdmin();
    error ZeroAddress();
    error ZeroAmount();

    // ── Modifiers ───────────────────────────────────────────────────────

    modifier onlyAdmin() {
        if (!campusRoles.hasRole(campusRoles.DEFAULT_ADMIN_ROLE(), msg.sender)) {
            revert NotAdmin();
        }
        _;
    }

    // ── Functions ───────────────────────────────────────────────────────

    // ── Constructor ─────────────────────────────────────────────────────

    constructor(address _campusRoles) ERC20("LibraryToken", "LIBT") {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── Public pure functions ───────────────────────────────────────────

    /// @notice Decimales del token
    /// @dev Se usa 0 para manejar unidades enteras
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    // ── External functions ──────────────────────────────────────────────

    /// @notice Configura el spender de confianza
    /// @dev Debe apuntar al contrato LibraryManager
    function setTrustedSpender(address spender) external onlyAdmin {
        if (spender == address(0)) {
            revert ZeroAddress();
        }
        trustedSpender = spender;
    }

    /// @notice Mintea tokens de capacidad de prestamo
    function mint(address to, uint256 amount) external onlyAdmin {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        _mint(to, amount);
    }

    /// @notice Quema tokens de una cuenta
    function burn(address from, uint256 amount) external onlyAdmin {
        if (from == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        _burn(from, amount);
    }

    // ── Public view functions ───────────────────────────────────────────

    /// @notice Consulta allowance entre owner y spender
    /// @dev Si spender es trustedSpender retorna allowance infinito
    function allowance(address owner, address spender) public view override returns (uint256) {
        if (spender == trustedSpender && trustedSpender != address(0)) {
            return type(uint256).max;
        }
        return super.allowance(owner, spender);
    }
}
