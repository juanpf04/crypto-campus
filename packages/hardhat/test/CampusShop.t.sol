// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { ShopToken } from "../contracts/ShopToken.sol";
import { CampusShop } from "../contracts/CampusShop.sol";

/// @title CampusShopTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas de comportamiento y reverts para flujos de compra y devolucion en CampusShop.
/// @dev Cubre rutas de administrador y estudiante, incluyendo pausado y validaciones de existencias.
contract CampusShopTest is Test {
    
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    ShopToken shopToken;
    CampusShop campusShop;

    address student;
    address outsider;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        shopToken = new ShopToken(address(campusRoles));
        campusShop = new CampusShop(address(campusRoles), address(shopToken), "https://shop.ucm.es/");

        student = makeAddr("student");
        outsider = makeAddr("outsider");

        campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());

        shopToken.setTrustedSpender(address(campusShop));
        shopToken.mint(student, 200);

        campusShop.addProduct(50, 10);
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_PurchaseAndAdminReturn() public {
        vm.prank(student);
        campusShop.purchase(1);

        assertEq(shopToken.balanceOf(student), 150);
        assertEq(shopToken.balanceOf(address(campusShop)), 50);
        assertEq(campusShop.balanceOf(student, 1), 1);

        campusShop.processReturn(1);

        assertEq(shopToken.balanceOf(student), 200);
        assertEq(campusShop.balanceOf(student, 1), 0);

        CampusShop.Order memory order = campusShop.getOrder(1);
        assertEq(uint256(order.status), uint256(CampusShop.OrderStatus.Returned));
    }

    function test_RevertRequestReturnAfterWindow() public {
        vm.prank(student);
        campusShop.purchase(1);

        campusShop.markDelivered(1);

        vm.warp(block.timestamp + 31 days);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(CampusShop.ReturnWindowExpired.selector, 1));
        campusShop.requestReturn(1);
    }

    function test_UpdateProduct() public {
        campusShop.updateProduct(1, 75, 20);

        (uint256 price, uint256 stock, bool active, bool exists_) = campusShop.getProduct(1);
        assertEq(price, 75);
        assertEq(stock, 20);
        assertTrue(active);
        assertTrue(exists_);
    }

    function test_RevertUpdateProductZeroPrice() public {
        vm.expectRevert(CampusShop.ZeroPrice.selector);
        campusShop.updateProduct(1, 0, 20);
    }

    function test_RevertUpdateProductNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(CampusShop.ProductNotFound.selector, 999));
        campusShop.updateProduct(999, 50, 10);
    }

    function test_DeactivateAndReactivateProduct() public {
        campusShop.deactivateProduct(1);

        (, , bool activeAfterDeactivate, ) = campusShop.getProduct(1);
        assertFalse(activeAfterDeactivate);

        campusShop.reactivateProduct(1);

        (, , bool activeAfterReactivate, ) = campusShop.getProduct(1);
        assertTrue(activeAfterReactivate);
    }

    function test_RevertDeactivateAlreadyInactive() public {
        campusShop.deactivateProduct(1);

        vm.expectRevert(abi.encodeWithSelector(CampusShop.ProductAlreadyInState.selector, 1, false));
        campusShop.deactivateProduct(1);
    }

    function test_RevertReactivateAlreadyActive() public {
        vm.expectRevert(abi.encodeWithSelector(CampusShop.ProductAlreadyInState.selector, 1, true));
        campusShop.reactivateProduct(1);
    }

    function test_RevertPurchaseInactiveProduct() public {
        campusShop.deactivateProduct(1);

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(CampusShop.ProductNotActive.selector, 1));
        campusShop.purchase(1);
    }

    function test_RevertPurchaseOutOfStock() public {
        // Anadir un producto con existencias=1.
        campusShop.addProduct(10, 1); // productId = 2

        vm.prank(student);
        campusShop.purchase(2); // primera compra con exito

        vm.prank(student);
        vm.expectRevert(abi.encodeWithSelector(CampusShop.ProductOutOfStock.selector, 2));
        campusShop.purchase(2); // segunda compra falla
    }

    function test_RevertPurchaseNonStudent() public {
        vm.prank(outsider);
        vm.expectRevert(CampusShop.NotStudent.selector);
        campusShop.purchase(1);
    }

    function test_MarkDeliveredAndRequestReturn() public {
        vm.prank(student);
        campusShop.purchase(1);

        campusShop.markDelivered(1);

        vm.prank(student);
        campusShop.requestReturn(1);

        CampusShop.Order memory order = campusShop.getOrder(1);
        assertEq(uint256(order.status), uint256(CampusShop.OrderStatus.Returned));
    }

    function test_RevertMarkDeliveredWrongState() public {
        vm.prank(student);
        campusShop.purchase(1);

        campusShop.markDelivered(1);

        vm.expectRevert(abi.encodeWithSelector(CampusShop.InvalidOrderState.selector, 1, CampusShop.OrderStatus.Delivered));
        campusShop.markDelivered(1);
    }

    function test_PauseAndUnpause() public {
        // Admin pausa el contrato.
        campusShop.pause();

        // Comprar revierte mientras esta pausado.
        vm.prank(student);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        campusShop.purchase(1);

        // Admin reanuda el contrato.
        campusShop.unpause();

        // Ahora vuelve a funcionar.
        vm.prank(student);
        campusShop.purchase(1);
        assertEq(campusShop.balanceOf(student, 1), 1);
    }

    function test_ProcessReturnOnDeliveredOrder() public {
        vm.prank(student);
        campusShop.purchase(1);

        uint256 balanceBefore = shopToken.balanceOf(student);

        campusShop.markDelivered(1);
        campusShop.processReturn(1);

        assertEq(shopToken.balanceOf(student), balanceBefore + 50);
        assertEq(campusShop.balanceOf(student, 1), 0);

        CampusShop.Order memory order = campusShop.getOrder(1);
        assertEq(uint256(order.status), uint256(CampusShop.OrderStatus.Returned));
    }
}
