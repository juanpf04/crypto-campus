// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { CampusRoles } from "../contracts/CampusRoles.sol";
import { Printer } from "../contracts/Printer.sol";

/// @title PrinterTest
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Pruebas de comportamiento y reverts para la gestion de creditos en Printer.
/// @dev Se enfoca en permisos administrativos, emision de eventos y reglas de consumo de creditos.
contract PrinterTest is Test {
    
    // ── Variables de estado ──────────────────────────────────────────────

    CampusRoles campusRoles;
    Printer printer;

    address student;
    address outsider;

    // ── Setup ────────────────────────────────────────────────────────────

    function setUp() public {
        // Desplegar contratos y registrar un estudiante base para los escenarios de prueba.
        campusRoles = new CampusRoles();
        printer = new Printer(address(campusRoles));

        student = makeAddr("student");
        outsider = makeAddr("outsider");

        campusRoles.registerUser(student, "Alice", campusRoles.STUDENT_ROLE());
    }

    // ── Tests ────────────────────────────────────────────────────────────

    function test_InitialCreditsForRegisteredStudent() public view {
        // Verificar creditos por defecto para un estudiante registrado.
        assertEq(printer.getCredits(student), int256(200));
    }

    function test_GetCreditsReturnsMinusOneForNonStudent() public view {
        // Direcciones no estudiante deben devolver el valor centinela -1.
        assertEq(printer.getCredits(outsider), int256(-1));
    }

    function test_SetCreditsUpdatesStudentBalanceAndEmitsEvent() public {
        // Esperar evento antes de la llamada que cambia estado.
        vm.expectEmit();
        emit Printer.CreditsSet(student, 120);

        printer.setCredits(student, 120);

        assertEq(printer.getCredits(student), int256(120));
    }

    function test_PrintConsumesCreditsAndEmitsEvent() public {
        // Fijar creditos explicitos para verificar saldo restante determinista.
        printer.setCredits(student, 50);

        vm.expectEmit();
        emit Printer.PrintJobExecuted(student, 15, 35);

        printer.print(student, 15);

        assertEq(printer.getCredits(student), int256(35));
    }

    function test_RevertWhenPrintExceedsAvailableCredits() public {
        // Imprimir mas paginas que creditos disponibles debe revertir.
        printer.setCredits(student, 10);

        vm.expectRevert(abi.encodeWithSelector(Printer.InsufficientCredits.selector, 10, 20));
        printer.print(student, 20);
    }

    function test_RevertWhenNonAdminSetsCredits() public {
        // Cualquier llamador no administrador debe ser rechazado.
        vm.prank(student);
        vm.expectRevert(Printer.NotAdmin.selector);
        printer.setCredits(student, 100);
    }

    function test_RevertSetCreditsZeroAddress() public {
        vm.expectRevert(Printer.ZeroAddress.selector);
        printer.setCredits(address(0), 100);
    }

    function test_RevertPrintZeroAddress() public {
        vm.expectRevert(Printer.ZeroAddress.selector);
        printer.print(address(0), 10);
    }

    function test_RevertPrintZeroPages() public {
        vm.expectRevert(Printer.ZeroPages.selector);
        printer.print(student, 0);
    }

    function test_RevertNonAdminPrint() public {
        vm.prank(student);
        vm.expectRevert(Printer.NotAdmin.selector);
        printer.print(student, 10);
    }

    function test_PrintWithDefaultCredits() public {
        // Imprimir sin llamar a setCredits; debe usar INITIAL_CREDITS (200).
        printer.print(student, 30);
        assertEq(printer.getCredits(student), int256(170));
    }

    function test_SetCreditsToZero() public {
        printer.setCredits(student, 0);
        assertEq(printer.getCredits(student), int256(0));
    }

    function test_MultiplePrintsConsumeCorrectly() public {
        printer.setCredits(student, 50);

        printer.print(student, 20);
        assertEq(printer.getCredits(student), int256(30));

        printer.print(student, 15);
        assertEq(printer.getCredits(student), int256(15));

        printer.print(student, 15);
        assertEq(printer.getCredits(student), int256(0));
    }

    function test_PauseAndUnpause() public {
        // Admin pausa el contrato.
        printer.pause();

        // Imprimir revierte mientras esta pausado.
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        printer.print(student, 10);

        // Admin reanuda el contrato.
        printer.unpause();

        // Ahora vuelve a funcionar.
        printer.print(student, 10);
        assertEq(printer.getCredits(student), int256(190));
    }

    function test_RevertPrintAfterCreditsExhausted() public {
        printer.setCredits(student, 10);
        printer.print(student, 10);
        assertEq(printer.getCredits(student), int256(0));

        vm.expectRevert(abi.encodeWithSelector(Printer.InsufficientCredits.selector, 0, 1));
        printer.print(student, 1);
    }
}
