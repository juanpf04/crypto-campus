// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./CampusAccessControl.sol";

/**
 * @title LibraryToken
 * @dev Token ERC-20 de capacidad de prestamo bibliotecario.
 *      1 token = 1 slot de prestamo simultaneo.
 *      Se bloquea al pedir prestado un libro, se devuelve al devolverlo.
 */
contract LibraryToken is ERC20 {

    CampusAccessControl public immutable accessControl;

    /// @dev Tokens iniciales que recibe cada estudiante al ser dado de alta.
    uint256 public constant INITIAL_TOKENS = 10;

    /// @dev Contrato de confianza que puede gastar tokens sin approve individual.
    ///      Se configura una vez tras el despliegue con setTrustedSpender.
    address public trustedSpender;

    // --- Custom Errors ---
    error NotAdmin();
    error ZeroAddress();
    error ZeroAmount();

    constructor(address _accessControl) ERC20("LibraryToken", "LIBT") {
        accessControl = CampusAccessControl(_accessControl);
    }

    // --- Modifiers ---
    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender))
            revert NotAdmin();
        _;
    }

    /**
     * @dev Override decimals a 0 (tokens enteros, sin fracciones).
     */
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /**
     * @dev Configura el contrato de confianza (LibraryManager) que puede
     *      gastar tokens sin que cada usuario haga approve individualmente.
     *      Solo se necesita llamar una vez tras el despliegue.
     */
    function setTrustedSpender(address spender) external onlyAdmin {
        if (spender == address(0)) revert ZeroAddress();
        trustedSpender = spender;
    }

    /**
     * @dev Override: si el spender es el trustedSpender, devuelve max (approve infinito).
     *      Asi LibraryManager puede operar sin approve individual de cada estudiante.
     */
    function allowance(address owner, address spender) public view override returns (uint256) {
        if (spender == trustedSpender && trustedSpender != address(0)) {
            return type(uint256).max;
        }
        return super.allowance(owner, spender);
    }

    /**
     * @dev Mintea tokens de capacidad de prestamo al estudiante.
     *      Usar INITIAL_TOKENS (10) al dar de alta a un estudiante.
     */
    function mint(address to, uint256 amount) external onlyAdmin {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }

    /**
     * @dev Quema tokens (penalizacion o baja de estudiante).
     */
    function burn(address from, uint256 amount) external onlyAdmin {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _burn(from, amount);
    }
}
