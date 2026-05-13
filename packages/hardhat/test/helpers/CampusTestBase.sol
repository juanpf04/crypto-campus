// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { CampusRoles } from "../../contracts/CampusRoles.sol";

/// @title CampusTestBase
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Base abstracta para tests Foundry del ecosistema CryptoCampus.
/// @dev Centraliza la creacion de actores y el registro de roles para evitar
///      duplicacion entre los .t.sol. Cada test concreto sigue desplegando solo
///      los contratos que necesita (asi el bytecode embebido es minimo).
abstract contract CampusTestBase is Test {
    // ── Actores comunes ─────────────────────────────────────────────────

    address internal librarian;
    address internal professor;
    address internal student1;
    address internal student2;

    // ── Setup helpers ───────────────────────────────────────────────────

    /// @notice Crea las direcciones nombradas tipicas usadas en los tests
    /// @dev Llamar desde setUp() antes de registrar usuarios en CampusRoles
    function _initActors() internal {
        librarian = makeAddr("librarian");
        professor = makeAddr("professor");
        student1 = makeAddr("student1");
        student2 = makeAddr("student2");
    }

    /// @notice Registra los actores estandar en una instancia de CampusRoles
    /// @dev Asume que el caller actual (msg.sender del test) tiene ADMIN_ROLE
    /// @param roles Instancia de CampusRoles a poblar
    function _registerStandardUsers(CampusRoles roles) internal {
        roles.registerUser(librarian, "Librarian", roles.LIBRARIAN_ROLE());
        roles.registerUser(professor, "Professor", roles.PROFESSOR_ROLE());
        roles.registerUser(student1, "Student1", roles.STUDENT_ROLE());
        roles.registerUser(student2, "Student2", roles.STUDENT_ROLE());
    }

    /// @notice Atajo: inicializa actores y los registra en CampusRoles
    /// @param roles Instancia de CampusRoles a poblar
    function _initAndRegisterStandardUsers(CampusRoles roles) internal {
        _initActors();
        _registerStandardUsers(roles);
    }

    // ── Utilidades varias ───────────────────────────────────────────────

    /// @notice Construye un array con un unico address (helper comun en awardPrize)
    function _arr(address a) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = a;
    }

    /// @notice Construye un array con dos addresses
    function _arr(address a, address b) internal pure returns (address[] memory list) {
        list = new address[](2);
        list[0] = a;
        list[1] = b;
    }
}
