// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CampusRoles
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Gestion centralizada de roles para el ecosistema CryptoCampus
/// @dev Cada usuario tiene un unico rol funcional no acumulable.
///      Usa un ADMIN_ROLE custom en vez de DEFAULT_ADMIN_ROLE para evitar
///      conflicto con el sentinel NO_ROLE (bytes32(0)).
///      grantRole/revokeRole heredados de AccessControl estan bloqueados
///      para forzar el uso de registerUser/removeUser/changeRole.
contract CampusRoles is AccessControl, Pausable {

    // ── Type declarations ───────────────────────────────────────────────

    /// @notice Datos de usuario registrados en el sistema
    struct UserRecord {
        string name;
        bytes32 role; // 0 indica no registrado
    }

    // ── State variables ─────────────────────────────────────────────────

    /// @notice Rol de administrador (custom, no usa DEFAULT_ADMIN_ROLE para evitar colision con NO_ROLE)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Rol de bibliotecario
    bytes32 public constant LIBRARIAN_ROLE = keccak256("LIBRARIAN_ROLE");

    /// @notice Rol de profesor
    bytes32 public constant PROFESSOR_ROLE = keccak256("PROFESSOR_ROLE");

    /// @notice Rol de estudiante
    bytes32 public constant STUDENT_ROLE = keccak256("STUDENT_ROLE");

    /// @dev Valor centinela para indicar usuario sin rol
    bytes32 private constant NO_ROLE = bytes32(0);

    /// @dev Registro on-chain de datos basicos por direccion
    mapping(address => UserRecord) private _userRecords;

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Se emite al registrar un usuario
    /// @param user Direccion del usuario
    /// @param userData Datos registrados
    event UserRegistered(address indexed user, UserRecord userData);

    /// @notice Se emite al eliminar un usuario
    /// @param user Direccion del usuario eliminado
    /// @param previousData Datos previos antes de eliminar
    event UserRemoved(address indexed user, UserRecord previousData);

    /// @notice Se emite al cambiar el rol de un usuario
    /// @param user Direccion del usuario
    /// @param oldRole Rol previo
    /// @param newRole Rol nuevo
    /// @param userData Estado actualizado del usuario
    event UserRoleChanged(address indexed user, bytes32 oldRole, bytes32 newRole, UserRecord userData);

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice El usuario ya fue registrado
    /// @param user Direccion ya registrada
    error UserAlreadyRegistered(address user);

    /// @notice El usuario no existe en el registro
    /// @param user Direccion no registrada
    error UserNotRegistered(address user);

    /// @notice El rol indicado no es valido
    /// @param role Rol recibido que no pertenece al conjunto permitido
    error InvalidRole(bytes32 role);

    /// @notice La direccion no puede ser cero
    error ZeroAddress();

    /// @notice grantRole/revokeRole directos estan bloqueados
    error UseContractFunctions();

    // ── Modifiers ───────────────────────────────────────────────────────

    /// @notice Valida que el rol pertenezca al conjunto permitido
    /// @param role Rol a validar
    modifier validRole(bytes32 role) {
        if (
            role != LIBRARIAN_ROLE &&
            role != PROFESSOR_ROLE &&
            role != STUDENT_ROLE &&
            role != ADMIN_ROLE
        ) revert InvalidRole(role);
        _;
    }

    /// @notice Valida que una direccion no sea cero
    /// @param account Direccion a validar
    modifier notZeroAddress(address account) {
        if (account == address(0)) revert ZeroAddress();
        _;
    }

    // ── Functions ───────────────────────────────────────────────────────

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Otorga el rol admin inicial al deployer y configura la jerarquia de roles
    constructor() {
        // El deployer recibe ADMIN_ROLE (no DEFAULT_ADMIN_ROLE para evitar colision con NO_ROLE)
        _grantRole(ADMIN_ROLE, msg.sender);

        // Configurar que ADMIN_ROLE gestiona todos los roles (incluido a si mismo)
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(STUDENT_ROLE, ADMIN_ROLE);
        _setRoleAdmin(LIBRARIAN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(PROFESSOR_ROLE, ADMIN_ROLE);
    }

    // ── External functions ──────────────────────────────────────────────

    /// @notice Registra un nuevo usuario con rol inicial
    /// @dev El rol funcional es unico e inmutable salvo por changeRole
    /// @param user Direccion del usuario a registrar
    /// @param name Nombre del usuario
    /// @param role Rol inicial
    function registerUser(
        address user,
        string calldata name,
        bytes32 role
    )
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
        notZeroAddress(user)
        validRole(role)
    {
        if (_userRecords[user].role != NO_ROLE) revert UserAlreadyRegistered(user);

        UserRecord memory userData = UserRecord({name: name, role: role});
        _userRecords[user] = userData;
        _grantRole(role, user);

        emit UserRegistered(user, userData);
    }

    /// @notice Elimina un usuario y revoca su rol
    /// @param user Direccion del usuario a eliminar
    function removeUser(address user)
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
        notZeroAddress(user)
    {
        UserRecord memory previousData = _userRecords[user];
        if (previousData.role == NO_ROLE) revert UserNotRegistered(user);

        bytes32 oldRole = previousData.role;
        delete _userRecords[user];
        _revokeRole(oldRole, user);

        emit UserRemoved(user, previousData);
    }

    /// @notice Cambia el rol de un usuario
    /// @dev Revoca el rol anterior y otorga el nuevo
    /// @param user Direccion del usuario
    /// @param newRole Nuevo rol a asignar
    function changeRole(
        address user,
        bytes32 newRole
    )
        external
        onlyRole(ADMIN_ROLE)
        whenNotPaused
        notZeroAddress(user)
        validRole(newRole)
    {
        UserRecord storage userData = _userRecords[user];
        if (userData.role == NO_ROLE) revert UserNotRegistered(user);

        bytes32 oldRole = userData.role;
        _revokeRole(oldRole, user);
        _grantRole(newRole, user);
        userData.role = newRole;

        emit UserRoleChanged(user, oldRole, newRole, userData);
    }

    /// @notice Pausa el contrato (solo admin)
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ── External view functions ─────────────────────────────────────────

    /// @notice Indica si un usuario tiene rol de estudiante
    /// @param user Direccion a consultar
    /// @return True si el usuario es estudiante
    function isStudent(address user) external view returns (bool) {
        return hasRole(STUDENT_ROLE, user);
    }

    /// @notice Indica si un usuario tiene rol de bibliotecario
    /// @param user Direccion a consultar
    /// @return True si el usuario es bibliotecario
    function isLibrarian(address user) external view returns (bool) {
        return hasRole(LIBRARIAN_ROLE, user);
    }

    /// @notice Indica si un usuario tiene rol de profesor
    /// @param user Direccion a consultar
    /// @return True si el usuario es profesor
    function isProfessor(address user) external view returns (bool) {
        return hasRole(PROFESSOR_ROLE, user);
    }

    /// @notice Indica si un usuario tiene rol de administrador
    /// @param user Direccion a consultar
    /// @return True si el usuario es admin
    function isAdmin(address user) external view returns (bool) {
        return hasRole(ADMIN_ROLE, user);
    }

    /// @notice Obtiene informacion completa de un usuario
    /// @param user Direccion a consultar
    /// @return name Nombre del usuario
    /// @return role Rol registrado
    /// @return registered True si existe registro
    function getUserInfo(address user)
        external
        view
        returns (string memory name, bytes32 role, bool registered)
    {
        UserRecord storage userData = _userRecords[user];
        return (userData.name, userData.role, userData.role != NO_ROLE);
    }

    /// @notice Obtiene el rol registrado de un usuario
    /// @param user Direccion a consultar
    /// @return role Rol del usuario o bytes32(0) si no esta registrado
    function getUserRole(address user) external view returns (bytes32) {
        return _userRecords[user].role;
    }

    /// @notice Indica si una direccion esta registrada
    /// @param user Direccion a consultar
    /// @return True si tiene rol registrado
    function isRegistered(address user) external view returns (bool) {
        return _userRecords[user].role != NO_ROLE;
    }

    // ── Public pure functions ────────────────────────────────────────────

    /// @dev Bloqueado: usar registerUser/changeRole en su lugar
    function grantRole(bytes32, address) public pure override {
        revert UseContractFunctions();
    }

    /// @dev Bloqueado: usar removeUser/changeRole en su lugar
    function revokeRole(bytes32, address) public pure override {
        revert UseContractFunctions();
    }
}
