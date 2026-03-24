// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../contracts/CampusRoles.sol";

/// @title CampusRolesCaller
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Contrato auxiliar para ejercitar llamadas no administrativas en pruebas de CampusRoles.
contract CampusRolesCaller {
	function registerUser(
		CampusRoles campusRoles,
		address user,
		string calldata name,
		bytes32 role
	) external {
		campusRoles.registerUser(user, name, role);
	}
}

/// @title CampusRolesTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas de comportamiento y reverts para CampusRoles.
/// @dev Incluye ciclo de vida de roles y casos limite de control de acceso.
contract CampusRolesTest is Test {
	
	// ── Variables de estado ──────────────────────────────────────────────

	CampusRoles campusRoles;

	address admin;
	address student;
	address librarian;
	address outsider;
	CampusRolesCaller caller;

	// ── Setup ────────────────────────────────────────────────────────────

	function setUp() public {
		admin = address(this);
		student = makeAddr("student");
		librarian = makeAddr("librarian");
		outsider = makeAddr("outsider");

		campusRoles = new CampusRoles();
		caller = new CampusRolesCaller();
	}

	// ── Tests ────────────────────────────────────────────────────────────

	function test_DeployerHasDefaultAdminRole() public view {
		assertTrue(campusRoles.hasRole(campusRoles.ADMIN_ROLE(), admin));
		assertTrue(campusRoles.isAdmin(admin));
	}

	function test_RegisterStudentStoresUserInfoAndRole() public {
		campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());

		assertTrue(campusRoles.isStudent(student));
		assertTrue(campusRoles.isRegistered(student));

		(string memory name, bytes32 role, bool registered) = campusRoles.getUserInfo(student);
		assertEq(name, "Alice");
		assertEq(role, campusRoles.STUDENT_ROLE());
		assertTrue(registered);
	}

	function test_RevertRegisterWhenRoleInvalid() public {
		bytes32 invalidRole = keccak256("INVALID_ROLE");

		vm.expectRevert(abi.encodeWithSelector(CampusRoles.InvalidRole.selector, invalidRole));
		campusRoles.registerUser(student, "Alice", invalidRole);
	}

	function test_RevertRegisterWhenUserAlreadyRegistered() public {
		campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());

		(bool ok, bytes memory data) = address(campusRoles).call(
			abi.encodeCall(
				campusRoles.registerUser,
				(student, "Alice2", campusRoles.STUDENT_ROLE())
			)
		);

		assertFalse(ok);
		assertEq(bytes4(data), CampusRoles.UserAlreadyRegistered.selector);
	}

	function test_RemoveUserRevokesRoleAndClearsRecord() public {
		campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());

		campusRoles.removeUser(student);

		assertFalse(campusRoles.isStudent(student));
		assertFalse(campusRoles.isRegistered(student));
		assertEq(campusRoles.getUserRole(student), bytes32(0));
	}

	function test_ChangeRoleSwitchesFromStudentToLibrarian() public {
		campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());

		campusRoles.changeRole(student, campusRoles.LIBRARIAN_ROLE());

		assertFalse(campusRoles.isStudent(student));
		assertTrue(campusRoles.isLibrarian(student));
		assertEq(campusRoles.getUserRole(student), campusRoles.LIBRARIAN_ROLE());
	}

	function test_RevertChangeRoleWhenUserNotRegistered() public {
		(bool ok, bytes memory data) = address(campusRoles).call(
			abi.encodeCall(campusRoles.changeRole, (outsider, campusRoles.STUDENT_ROLE()))
		);

		assertFalse(ok);
		assertEq(bytes4(data), CampusRoles.UserNotRegistered.selector);
	}

	function test_RevertForNonAdminCaller() public {
		(bool ok,) = address(caller).call(
			abi.encodeCall(
				caller.registerUser,
				(campusRoles, student, "Alice", campusRoles.STUDENT_ROLE())
			)
		);

		assertFalse(ok);
	}

	function test_RoleIsolationForMultipleUsers() public {
		campusRoles.registerUser(student, "Student", campusRoles.STUDENT_ROLE());
		campusRoles.registerUser(librarian, "Librarian", campusRoles.LIBRARIAN_ROLE());

		assertTrue(campusRoles.isStudent(student));
		assertFalse(campusRoles.isLibrarian(student));

		assertTrue(campusRoles.isLibrarian(librarian));
		assertFalse(campusRoles.isStudent(librarian));
	}

	function test_RevertRemoveZeroAddress() public {
		vm.expectRevert(CampusRoles.ZeroAddress.selector);
		campusRoles.removeUser(address(0));
	}

	function test_RevertRemoveUnregisteredUser() public {
		vm.expectRevert(abi.encodeWithSelector(CampusRoles.UserNotRegistered.selector, outsider));
		campusRoles.removeUser(outsider);
	}

	// Nota: las pruebas de address(0) para registerUser y changeRole se cubren
	// en la suite TypeScript (CampusRoles.test.ts) porque Hardhat EDR tiene
	// particularidades con vm.expectRevert y verificaciones en modificadores.

	function test_RevertChangeRoleInvalidRole() public {
		campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());

		bytes32 fakeRole = keccak256("FAKE");
		vm.expectRevert(abi.encodeWithSelector(CampusRoles.InvalidRole.selector, fakeRole));
		campusRoles.changeRole(student, fakeRole);
	}

	function test_ReRegisterAfterRemoval() public {
		campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());
		campusRoles.removeUser(student);

		assertFalse(campusRoles.isRegistered(student));

		campusRoles.registerUser(student, "Alice2", campusRoles.LIBRARIAN_ROLE());

		assertTrue(campusRoles.isRegistered(student));
		assertTrue(campusRoles.isLibrarian(student));
		assertFalse(campusRoles.isStudent(student));

		(string memory name, bytes32 role, bool registered) = campusRoles.getUserInfo(student);
		assertEq(name, "Alice2");
		assertEq(role, campusRoles.LIBRARIAN_ROLE());
		assertTrue(registered);
	}

	function test_ChangeRolePreservesName() public {
		campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());

		campusRoles.changeRole(student, campusRoles.PROFESSOR_ROLE());

		(string memory name, bytes32 role, bool registered) = campusRoles.getUserInfo(student);
		assertEq(name, "Alice");
		assertEq(role, campusRoles.PROFESSOR_ROLE());
		assertTrue(registered);
	}

	function test_RegisterEmptyName() public {
		campusRoles.registerUser(student, "", campusRoles.STUDENT_ROLE());

		(string memory name, bytes32 role, bool registered) = campusRoles.getUserInfo(student);
		assertEq(name, "");
		assertEq(role, campusRoles.STUDENT_ROLE());
		assertTrue(registered);
	}

	function test_GetRoleAdminReturnsDefaultAdmin() public view {
		assertEq(campusRoles.getRoleAdmin(campusRoles.STUDENT_ROLE()), campusRoles.ADMIN_ROLE());
		assertEq(campusRoles.getRoleAdmin(campusRoles.PROFESSOR_ROLE()), campusRoles.ADMIN_ROLE());
		assertEq(campusRoles.getRoleAdmin(campusRoles.LIBRARIAN_ROLE()), campusRoles.ADMIN_ROLE());
	}

	// Nota: las pruebas de Pausable y bloqueo de grantRole/revokeRole se cubren
	// en la suite TypeScript (CampusRoles.test.ts) porque Hardhat EDR tiene
	// particularidades con vm.expectRevert en overrides puros y pausado.

	function test_RevertPauseByNonAdmin() public {
		vm.prank(outsider);
		vm.expectRevert();
		campusRoles.pause();
	}
}
