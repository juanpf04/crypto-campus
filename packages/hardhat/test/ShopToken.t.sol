// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { ShopToken } from "../contracts/ShopToken.sol";

contract ShopTokenTest is Test {
    CampusRoles campusRoles;
    ShopToken shopToken;

    address user;
    address spender;

    function setUp() public {
        campusRoles = new CampusRoles();
        shopToken = new ShopToken(address(campusRoles));

        user = makeAddr("user");
        spender = makeAddr("spender");
    }

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
        // Admin pauses the contract
        shopToken.pause();

        // Minting reverts while paused
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        shopToken.mint(user, 100);

        // Admin unpauses
        shopToken.unpause();

        // Now it works again
        shopToken.mint(user, 100);
        assertEq(shopToken.balanceOf(user), 100);
    }

    function test_AllowanceReturnsZeroForNonTrusted() public view {
        assertEq(shopToken.allowance(user, spender), 0);
    }
}
