// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";

contract LibraryTokenTest is Test {
    CampusRoles campusRoles;
    LibraryToken libraryToken;

    address user;
    address spender;

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));

        user = makeAddr("user");
        spender = makeAddr("spender");
    }

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
}
