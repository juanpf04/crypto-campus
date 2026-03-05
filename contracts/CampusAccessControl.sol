// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CampusAccessControl
 * @dev Gestion centralizada de roles para el ecosistema CryptoCampus.
 *      Cada usuario tiene UN UNICO ROL (no acumulable).
 *      Todos los demas contratos consultan este para verificar permisos.
 */
contract CampusAccessControl is AccessControl {

    bytes32 public constant LIBRARIAN_ROLE = keccak256("LIBRARIAN_ROLE");
    bytes32 public constant PROFESSOR_ROLE = keccak256("PROFESSOR_ROLE");
    bytes32 public constant STUDENT_ROLE   = keccak256("STUDENT_ROLE");

    struct User {
        string name;
        bytes32 role;       // El unico rol del usuario (bytes32(0) = no registrado)
    }

    mapping(address => User) private _users;

    // --- Custom Errors ---
    error UserAlreadyRegistered(address user);
    error UserNotRegistered(address user);
    error InvalidRole(bytes32 role);
    error ZeroAddress();

    // --- Events ---
    event UserRegistered(address indexed user, string name, bytes32 role);
    event UserRemoved(address indexed user);
    event UserRoleChanged(address indexed user, bytes32 oldRole, bytes32 newRole);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // --- Modifiers ---
    modifier validRole(bytes32 role) {
        if (
            role != LIBRARIAN_ROLE &&
            role != PROFESSOR_ROLE &&
            role != STUDENT_ROLE
        ) revert InvalidRole(role);
        _;
    }

    modifier notZeroAddress(address account) {
        if (account == address(0)) revert ZeroAddress();
        _;
    }

    // --- Functions ---

    /**
     * @dev Registra un nuevo usuario con su rol (unico e inmutable salvo changeRole).
     */
    function registerUser(
        address user,
        string calldata name,
        bytes32 role
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        notZeroAddress(user)
        validRole(role)
    {
        if (_users[user].role != bytes32(0)) revert UserAlreadyRegistered(user);

        _users[user] = User({name: name, role: role});
        _grantRole(role, user);

        emit UserRegistered(user, name, role);
    }

    /**
     * @dev Elimina un usuario y revoca su rol.
     */
    function removeUser(address user)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        notZeroAddress(user)
    {
        if (_users[user].role == bytes32(0)) revert UserNotRegistered(user);

        bytes32 oldRole = _users[user].role;
        delete _users[user];
        _revokeRole(oldRole, user);

        emit UserRemoved(user);
    }

    /**
     * @dev Cambia el rol de un usuario (revoca el anterior, otorga el nuevo).
     */
    function changeRole(
        address user,
        bytes32 newRole
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        notZeroAddress(user)
        validRole(newRole)
    {
        if (_users[user].role == bytes32(0)) revert UserNotRegistered(user);

        bytes32 oldRole = _users[user].role;
        _revokeRole(oldRole, user);
        _grantRole(newRole, user);
        _users[user].role = newRole;

        emit UserRoleChanged(user, oldRole, newRole);
    }

    // --- View Functions ---

    function isStudent(address user) external view returns (bool) {
        return hasRole(STUDENT_ROLE, user);
    }

    function isLibrarian(address user) external view returns (bool) {
        return hasRole(LIBRARIAN_ROLE, user);
    }

    function isProfessor(address user) external view returns (bool) {
        return hasRole(PROFESSOR_ROLE, user);
    }

    function isAdmin(address user) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, user);
    }

    function getUserInfo(address user) external view returns (string memory name, bytes32 role, bool registered) {
        User storage u = _users[user];
        return (u.name, u.role, u.role != bytes32(0));
    }

    function getUserRole(address user) external view returns (bytes32) {
        return _users[user].role;
    }

    function isRegistered(address user) external view returns (bool) {
        return _users[user].role != bytes32(0);
    }
}
