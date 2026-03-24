// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { ShopToken } from "../contracts/ShopToken.sol";

/// @title ShopTokenTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas de comportamiento y reverts para la logica administrativa y de allowance en ShopToken.
/// @dev Valida la semantica del trusted spender, el pausado y las validaciones de argumentos.
contract ShopTokenTest is Test {
    
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    ShopToken shopToken;

    address user;
    address spender;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        shopToken = new ShopToken(address(campusRoles));

        user = makeAddr("user");
        spender = makeAddr("spender");
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_MintAndBurnAsAdmin() public {
        shopToken.mint(user, 100);
        assertEq(shopToken.balanceOf(user), 100);

        shopToken.burn(user, 40);
        assertEq(shopToken.balanceOf(user), 60);
    }

    function test_TrustedSpenderHasInfiniteAllowance() public {
        shopToken.mint(user, 100);
        shopToken.setTrustedSpender(spender);

        assertEq(shopToken.allowance(user, spender), type(uint256).max);

        vm.prank(spender);
        shopToken.transferFrom(user, spender, 25);

        assertEq(shopToken.balanceOf(user), 75);
        assertEq(shopToken.balanceOf(spender), 25);
    }

    function test_DecimalsReturnsZero() public view {
        assertEq(shopToken.decimals(), 0);
    }

    function test_RevertMintZeroAddress() public {
        vm.expectRevert(ShopToken.ZeroAddress.selector);
        shopToken.mint(address(0), 1);
    }

    function test_RevertMintZeroAmount() public {
        vm.expectRevert(ShopToken.ZeroAmount.selector);
        shopToken.mint(user, 0);
    }

    function test_RevertMintNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(ShopToken.NotAdmin.selector);
        shopToken.mint(user, 1);
    }

    function test_RevertBurnZeroAddress() public {
        vm.expectRevert(ShopToken.ZeroAddress.selector);
        shopToken.burn(address(0), 1);
    }

    function test_RevertBurnZeroAmount() public {
        shopToken.mint(user, 50);

        vm.expectRevert(ShopToken.ZeroAmount.selector);
        shopToken.burn(user, 0);
    }

    function test_RevertBurnNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(ShopToken.NotAdmin.selector);
        shopToken.burn(user, 1);
    }

    function test_RevertSetTrustedSpenderZeroAddress() public {
        vm.expectRevert(ShopToken.ZeroAddress.selector);
        shopToken.setTrustedSpender(address(0));
    }

    function test_RevertSetTrustedSpenderNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(ShopToken.NotAdmin.selector);
        shopToken.setTrustedSpender(spender);
    }

    function test_PauseAndUnpause() public {
        // Admin pausa el contrato.
        shopToken.pause();

        // Mint revierte mientras esta pausado.
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        shopToken.mint(user, 100);

        // Admin reanuda el contrato.
        shopToken.unpause();

        // Ahora vuelve a funcionar.
        shopToken.mint(user, 100);
        assertEq(shopToken.balanceOf(user), 100);
    }

    function test_AllowanceReturnsZeroForNonTrusted() public view {
        assertEq(shopToken.allowance(user, spender), 0);
    }
}
