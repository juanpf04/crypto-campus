// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { ShopToken } from "../contracts/ShopToken.sol";
import { CampusShop } from "../contracts/CampusShop.sol";

contract CampusShopTest is Test {
    CampusRoles campusRoles;
    ShopToken shopToken;
    CampusShop campusShop;

    address student;

    function setUp() public {
        campusRoles = new CampusRoles();
        shopToken = new ShopToken(address(campusRoles));
        campusShop = new CampusShop(address(campusRoles), address(shopToken), "https://shop.ucm.es/");

        student = makeAddr("student");

        campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());

        shopToken.setTrustedSpender(address(campusShop));
        shopToken.mint(student, 200);

        campusShop.addProduct(50, 10);
    }

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
}
