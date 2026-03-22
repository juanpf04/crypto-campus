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
}
