// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";

/// @title LibraryTokenTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas de comportamiento y reverts para la logica administrativa y de allowance en LibraryToken.
/// @dev Valida el trusted spender, el pausado y las validaciones de entrada.
contract LibraryTokenTest is Test {
    
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    LibraryToken libraryToken;

    address user;
    address spender;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));

        user = makeAddr("user");
        spender = makeAddr("spender");
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_MintAndBurnAsAdmin() public {
        libraryToken.mint(user, 10);
        assertEq(libraryToken.balanceOf(user), 10);

        libraryToken.burn(user, 4);
        assertEq(libraryToken.balanceOf(user), 6);
    }

    function test_TrustedSpenderHasInfiniteAllowance() public {
        libraryToken.mint(user, 10);
        libraryToken.setTrustedSpender(spender);

        assertEq(libraryToken.allowance(user, spender), type(uint256).max);

        vm.prank(spender);
        libraryToken.transferFrom(user, spender, 3);

        assertEq(libraryToken.balanceOf(user), 7);
        assertEq(libraryToken.balanceOf(spender), 3);
    }

    function test_DecimalsReturnsZero() public view {
        assertEq(libraryToken.decimals(), 0);
    }

    function test_RevertMintZeroAddress() public {
        vm.expectRevert(LibraryToken.ZeroAddress.selector);
        libraryToken.mint(address(0), 1);
    }

    function test_RevertMintZeroAmount() public {
        vm.expectRevert(LibraryToken.ZeroAmount.selector);
        libraryToken.mint(user, 0);
    }

    function test_RevertMintNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(LibraryToken.NotAdmin.selector);
        libraryToken.mint(user, 1);
    }

    function test_RevertBurnZeroAddress() public {
        vm.expectRevert(LibraryToken.ZeroAddress.selector);
        libraryToken.burn(address(0), 1);
    }

    function test_RevertBurnZeroAmount() public {
        libraryToken.mint(user, 5);

        vm.expectRevert(LibraryToken.ZeroAmount.selector);
        libraryToken.burn(user, 0);
    }

    function test_RevertBurnNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(LibraryToken.NotAdmin.selector);
        libraryToken.burn(user, 1);
    }

    function test_RevertSetTrustedSpenderZeroAddress() public {
        vm.expectRevert(LibraryToken.ZeroAddress.selector);
        libraryToken.setTrustedSpender(address(0));
    }

    function test_RevertSetTrustedSpenderNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(LibraryToken.NotAdmin.selector);
        libraryToken.setTrustedSpender(spender);
    }

    function test_AllowanceReturnsZeroForNonTrusted() public view {
        assertEq(libraryToken.allowance(user, spender), 0);
    }

    function test_PauseAndUnpause() public {
        // Admin pausa el contrato.
        libraryToken.pause();

        // Mint revierte mientras esta pausado.
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        libraryToken.mint(user, 10);

        // Admin reanuda el contrato.
        libraryToken.unpause();

        // Ahora vuelve a funcionar.
        libraryToken.mint(user, 10);
        assertEq(libraryToken.balanceOf(user), 10);
    }

    function test_ChangeTrustedSpender() public {
        address spender2 = makeAddr("spender2");

        libraryToken.setTrustedSpender(spender);
        assertEq(libraryToken.allowance(user, spender), type(uint256).max);

        libraryToken.setTrustedSpender(spender2);
        assertEq(libraryToken.allowance(user, spender2), type(uint256).max);
        assertEq(libraryToken.allowance(user, spender), 0);
    }
}
