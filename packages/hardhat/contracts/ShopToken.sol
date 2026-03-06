// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./CampusAccessControl.sol";

/**
 * @title ShopToken
 * @dev Token ERC-20 de pago para la tienda del campus.
 *      Se gana asistiendo a eventos, charlas, buen comportamiento, etc.
 *      Se gasta comprando productos en CampusShop.
 */
contract ShopToken is ERC20 {

    CampusAccessControl public immutable accessControl;

    /// @dev Contrato de confianza que puede gastar tokens sin approve individual.
    ///      Se configura una vez tras el despliegue con setTrustedSpender.
    address public trustedSpender;

    // --- Custom Errors ---
    error NotAdmin();
    error ZeroAddress();
    error ZeroAmount();
    // TODO: Revisar si finalmente se necesita mintBatch y su error asociado
    // error ArrayLengthMismatch();

    constructor(address _accessControl) ERC20("ShopToken", "SHPT") {
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
     * @dev Configura el contrato de confianza (CampusShop) que puede
     *      gastar tokens sin que cada usuario haga approve individualmente.
     *      Solo se necesita llamar una vez tras el despliegue.
     */
    function setTrustedSpender(address spender) external onlyAdmin {
        if (spender == address(0)) revert ZeroAddress();
        trustedSpender = spender;
    }

    /**
     * @dev Override: si el spender es el trustedSpender, devuelve max (approve infinito).
     *      Asi CampusShop puede operar sin approve individual de cada estudiante.
     */
    function allowance(address owner, address spender) public view override returns (uint256) {
        if (spender == trustedSpender && trustedSpender != address(0)) {
            return type(uint256).max;
        }
        return super.allowance(owner, spender);
    }

    /**
     * @dev Mintea tokens a un usuario (por eventos, registro, etc.)
     */
    function mint(address to, uint256 amount) external onlyAdmin {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }

    // TODO: Revisar si finalmente se anade mintBatch
    // /**
    //  * @dev Mintea tokens a multiples usuarios en batch.
    //  */
    // function mintBatch(
    //     address[] calldata recipients,
    //     uint256[] calldata amounts
    // ) external onlyAdmin {
    //     if (recipients.length != amounts.length) revert ArrayLengthMismatch();
    //
    //     for (uint256 i = 0; i < recipients.length;) {
    //         if (recipients[i] == address(0)) revert ZeroAddress();
    //         if (amounts[i] == 0) revert ZeroAmount();
    //         _mint(recipients[i], amounts[i]);
    //         unchecked { ++i; }
    //     }
    // }

    /**
     * @dev Quema tokens si es necesario (admin only).
     */
    function burn(address from, uint256 amount) external onlyAdmin {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _burn(from, amount);
    }
}
