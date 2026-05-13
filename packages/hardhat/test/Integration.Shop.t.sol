// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { CampusTestBase } from "./helpers/CampusTestBase.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { ShopToken } from "../contracts/ShopToken.sol";
import { CampusShop } from "../contracts/CampusShop.sol";

/// @title IntegrationShopTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas end-to-end del modulo Tienda (ShopToken + CampusShop).
contract IntegrationShopTest is CampusTestBase {
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    ShopToken shopToken;
    CampusShop campusShop;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        shopToken = new ShopToken(address(campusRoles));
        campusShop = new CampusShop(address(campusRoles), address(shopToken), "https://shop.ucm.es/");

        _initAndRegisterStandardUsers(campusRoles);

        shopToken.setTrustedSpender(address(campusShop));

        shopToken.mint(student1, 200);
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_FullShopReturnFlow() public {
        // Admin anade un producto (price=80, existencias=5).
        campusShop.addProduct(80, 5);

        // student1 compra el producto.
        vm.prank(student1);
        campusShop.purchase(1);

        // Verificar compra: NFT recibo minteado, tokens descontados y existencias reducidas.
        assertEq(campusShop.balanceOf(student1, 1), 1);
        assertEq(shopToken.balanceOf(student1), 120);

        // Admin marca como entregado.
        campusShop.markDelivered(1);

        // student1 solicita devolucion.
        vm.prank(student1);
        campusShop.requestReturn(1);

        // Verificar reembolso, recibo quemado, recibo de devolucion minteado y existencias restauradas.
        assertEq(shopToken.balanceOf(student1), 200);
        assertEq(campusShop.balanceOf(student1, 1), 0);

        uint256 returnTokenId = campusShop.getReturnReceiptTokenId(1);
        assertEq(campusShop.balanceOf(student1, returnTokenId), 1);

        (, uint256 stock, , ) = campusShop.getProduct(1);
        assertEq(stock, 5);
    }
}
