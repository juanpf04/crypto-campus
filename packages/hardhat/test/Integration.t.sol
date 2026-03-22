// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";
import { LibraryToken } from "../contracts/LibraryToken.sol";
import { ShopToken } from "../contracts/ShopToken.sol";
import { Printer } from "../contracts/Printer.sol";
import { LibraryManager } from "../contracts/LibraryManager.sol";
import { BadgeSystem } from "../contracts/BadgeSystem.sol";
import { CampusShop } from "../contracts/CampusShop.sol";

contract IntegrationTest is Test {
    CampusRoles campusRoles;
    LibraryToken libraryToken;
    ShopToken shopToken;
    Printer printer;
    LibraryManager libraryManager;
    BadgeSystem badgeSystem;
    CampusShop campusShop;

    address librarian;
    address professor;
    address student1;
    address student2;

    function setUp() public {
        campusRoles = new CampusRoles();
        libraryToken = new LibraryToken(address(campusRoles));
        shopToken = new ShopToken(address(campusRoles));
        printer = new Printer(address(campusRoles));
        libraryManager = new LibraryManager(address(campusRoles), address(libraryToken), "https://library.ucm.es/");
        badgeSystem = new BadgeSystem(address(campusRoles), "https://badges.ucm.es/");
        campusShop = new CampusShop(address(campusRoles), address(shopToken), "https://shop.ucm.es/");

        librarian = makeAddr("librarian");
        professor = makeAddr("professor");
        student1 = makeAddr("student1");
        student2 = makeAddr("student2");

        campusRoles.registerUser(librarian, "Librarian", campusRoles.LIBRARIAN_ROLE());
        campusRoles.registerUser(professor, "Professor", campusRoles.PROFESSOR_ROLE());
        campusRoles.registerUser(student1, "Student1", campusRoles.STUDENT_ROLE());
        campusRoles.registerUser(student2, "Student2", campusRoles.STUDENT_ROLE());

        libraryToken.setTrustedSpender(address(libraryManager));
        shopToken.setTrustedSpender(address(campusShop));

        libraryToken.mint(student1, 10);
        libraryToken.mint(student2, 10);
        shopToken.mint(student1, 200);
        shopToken.mint(student2, 150);
    }

    function test_CrossContractFlow() public {
        vm.prank(librarian);
        libraryManager.addBook(3);

        campusShop.addProduct(80, 10);

        vm.startPrank(professor);
        badgeSystem.createBadgeType();
        badgeSystem.createTask(1, 3);
        badgeSystem.createReward(1, 2, 10);
        vm.stopPrank();

        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.approveLoan(1);

        printer.print(student1, 15);

        vm.prank(student2);
        campusShop.purchase(1);

        vm.prank(professor);
        badgeSystem.awardBadge(1, student1);
        vm.prank(professor);
        badgeSystem.awardBadge(1, student2);

        vm.prank(student1);
        badgeSystem.redeemReward(1);

        assertEq(libraryManager.balanceOf(student1, 1), 1);
        assertEq(libraryToken.balanceOf(student1), 9);
        assertEq(printer.getCredits(student1), 185);
        assertEq(badgeSystem.getBadgeBalance(student1, 1), 1);
        assertEq(shopToken.balanceOf(student2), 70);
        assertEq(campusShop.balanceOf(student2, 1), 1);
    }

    function test_FullLibraryReturnFlow() public {
        // Librarian adds a book with 2 copies
        vm.prank(librarian);
        libraryManager.addBook(2);

        // Student1 requests and gets approved for a loan
        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.approveLoan(1);

        // Verify student1 holds the book NFT and deposit was taken
        assertEq(libraryManager.balanceOf(student1, 1), 1);
        assertEq(libraryToken.balanceOf(student1), 9);

        // Librarian confirms return
        vm.prank(librarian);
        libraryManager.confirmReturn(1);

        // Verify book NFT returned to contract, deposit refunded, loan completed
        assertEq(libraryManager.balanceOf(student1, 1), 0);
        assertEq(libraryToken.balanceOf(student1), 10);

        LibraryManager.Loan memory loan = libraryManager.getLoanInfo(1);
        assertTrue(loan.status == LibraryManager.LoanStatus.Returned);
    }

    function test_FullShopReturnFlow() public {
        // Admin adds a product (price=80, stock=5)
        campusShop.addProduct(80, 5);

        // Student1 purchases product
        vm.prank(student1);
        campusShop.purchase(1);

        // Verify purchase: receipt NFT minted, tokens deducted, stock decreased
        assertEq(campusShop.balanceOf(student1, 1), 1);
        assertEq(shopToken.balanceOf(student1), 120);

        // Admin marks delivered
        campusShop.markDelivered(1);

        // Student requests return
        vm.prank(student1);
        campusShop.requestReturn(1);

        // Verify refund, receipt burned, return receipt minted, stock restored
        assertEq(shopToken.balanceOf(student1), 200);
        assertEq(campusShop.balanceOf(student1, 1), 0);

        uint256 returnTokenId = campusShop.getReturnReceiptTokenId(1);
        assertEq(campusShop.balanceOf(student1, returnTokenId), 1);

        (, uint256 stock, , ) = campusShop.getProduct(1);
        assertEq(stock, 5);
    }

    function test_FullBadgeUseRequestFlow() public {
        // Professor creates badge type, task, reward
        vm.startPrank(professor);
        badgeSystem.createBadgeType();      // badgeTypeId = 1
        badgeSystem.createTask(1, 3);       // taskId = 1, awards 3 badges
        badgeSystem.createReward(1, 2, 10); // rewardId = 1, costs 2 badges
        vm.stopPrank();

        // Professor awards badge to student1
        vm.prank(professor);
        badgeSystem.awardBadge(1, student1);

        // Student1 redeems reward (burns 2 badges, gets reward token)
        vm.prank(student1);
        badgeSystem.redeemReward(1);

        uint256 rewardTokenId = badgeSystem.getRewardTokenId(1);
        assertEq(badgeSystem.balanceOf(student1, rewardTokenId), 1);

        // Student1 requests to use the reward
        vm.prank(student1);
        badgeSystem.requestUseReward(1);

        // Professor approves use request (burns reward token)
        vm.prank(professor);
        badgeSystem.approveUseRequest(1);

        // Verify reward token burned
        assertEq(badgeSystem.balanceOf(student1, rewardTokenId), 0);
    }

    function test_RoleRemovalBlocksAccess() public {
        // Student1 can print normally
        printer.print(student1, 10);
        assertEq(printer.getCredits(student1), int256(190));

        // Admin removes student1
        campusRoles.removeUser(student1);

        // Trying to print for removed user should revert with NotStudent
        vm.expectRevert(abi.encodeWithSelector(Printer.NotStudent.selector, student1));
        printer.print(student1, 5);
    }

    function test_OverdueForceReturnPenalty() public {
        // Librarian adds book
        vm.prank(librarian);
        libraryManager.addBook(2);

        // Student1 requests and gets loan approved
        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(librarian);
        libraryManager.approveLoan(1);

        // Deposit was taken
        assertEq(libraryToken.balanceOf(student1), 9);

        // Warp 22 days (past the 21-day default loan duration)
        vm.warp(block.timestamp + 22 days);

        // Librarian force returns
        vm.prank(librarian);
        libraryManager.forceReturn(1);

        // Book NFT returned to contract
        assertEq(libraryManager.balanceOf(student1, 1), 0);

        // Deposit NOT returned (penalty) — student still has 9 tokens
        assertEq(libraryToken.balanceOf(student1), 9);
    }

    // Note: Pausable cross-contract integration test is covered in
    // Integration.test.ts since Hardhat EDR has quirks with CampusRoles pause.

    function test_MultipleStudentsIndependentState() public {
        // Librarian adds book with 2 copies
        vm.prank(librarian);
        libraryManager.addBook(2);

        // Both students borrow the same book
        vm.prank(student1);
        libraryManager.requestLoan(1);
        vm.prank(student2);
        libraryManager.requestLoan(1);

        vm.prank(librarian);
        libraryManager.approveLoan(1); // student1's loan
        vm.prank(librarian);
        libraryManager.approveLoan(2); // student2's loan

        // Both hold book NFTs
        assertEq(libraryManager.balanceOf(student1, 1), 1);
        assertEq(libraryManager.balanceOf(student2, 1), 1);

        // Student1 returns
        vm.prank(librarian);
        libraryManager.confirmReturn(1);

        // Student1 no longer has the book
        assertEq(libraryManager.balanceOf(student1, 1), 0);

        // Student2 still has their loan active
        assertEq(libraryManager.balanceOf(student2, 1), 1);

        LibraryManager.Loan memory loan2 = libraryManager.getLoanInfo(2);
        assertTrue(loan2.status == LibraryManager.LoanStatus.Approved);
    }
}
