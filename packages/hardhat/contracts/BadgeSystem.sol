// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { CampusRoles } from "./CampusRoles.sol";

/// @title BadgeSystem
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Sistema de insignias academicas soulbound no transferibles
/// @dev Profesores crean insignias/tareas/recompensas y estudiantes las canjean.
contract BadgeSystem is ERC1155, ERC1155Supply, Pausable {
    // ── Type declarations ───────────────────────────────────────────────

    /// @notice Referencia al control de acceso del campus
    CampusRoles public immutable campusRoles;

    // Los metadatos (nombre, descripcion) se guardan en Prisma vinculados por ID.
    // En la blockchain solo guardamos lo estrictamente necesario para la logica.
    struct BadgeType {
        address creator;
        bool exists;
    }

    struct Task {
        uint256 badgeTypeId;
        uint256 rewardAmount;
        address professor;
        bool active;
    }

    struct Reward {
        uint256 badgeTypeId;   // tipo de insignia requerido
        uint256 badgeCost;     // cuantas insignias cuesta
        uint256 supply;        // supply restante (0 = ilimitado)
        uint256 totalSupply;   // supply original (0 = ilimitado)
        address professor;
        bool active;
    }

    struct Redemption {
        address student;
        uint256 rewardId;
        uint256 timestamp;
    }

    enum UseRequestStatus { None, Pending, Approved, Rejected, Cancelled }

    struct UseRequest {
        address student;
        uint256 rewardId;
        UseRequestStatus status;
    }

    // ── State variables ─────────────────────────────────────────────────
    uint256 public constant REWARD_TOKEN_OFFSET = 1_000_000;

    uint256 public nextBadgeTypeId = 1;
    mapping(uint256 => BadgeType) private _badgeTypes;

    uint256 public nextTaskId = 1;
    mapping(uint256 => Task) private _tasks;

    uint256 public nextRewardId = 1;
    mapping(uint256 => Reward) private _rewards;

    // Prevenir doble otorgamiento: student => taskId => awarded
    mapping(address => mapping(uint256 => bool)) public taskAwarded;

    // Registro de canjes
    uint256 public nextRedemptionId = 1;
    mapping(uint256 => Redemption) private _redemptions;
    mapping(address => uint256[]) private _studentRedemptions;

    // Solicitudes de uso de recompensa
    uint256 public nextUseRequestId = 1;
    mapping(uint256 => UseRequest) private _useRequests;
    mapping(address => uint256[]) private _studentUseRequests;

    // ── Events ──────────────────────────────────────────────────────────
    event BadgeTypeCreated(uint256 indexed badgeTypeId, address indexed professor);
    event TaskCreated(uint256 indexed taskId, uint256 indexed badgeTypeId, address indexed professor);
    event TaskDeactivated(uint256 indexed taskId);
    event BadgeAwarded(uint256 indexed taskId, address indexed student, uint256 indexed badgeTypeId, uint256 amount);
    event RewardCreated(uint256 indexed rewardId, uint256 badgeCost, uint256 supply, address indexed professor);
    event RewardDeactivated(uint256 indexed rewardId);
    event RewardRedeemed(
        uint256 indexed rewardId,
        address indexed student,
        uint256 indexed badgeTypeId,
        uint256 badgesBurned,
        uint256 redemptionId
    );
    event RewardTokenMinted(uint256 indexed rewardId, address indexed student, uint256 tokenId);
    event UseRequestCreated(uint256 indexed requestId, address indexed student, uint256 indexed rewardId);
    event UseRequestCancelled(uint256 indexed requestId);
    event UseRequestApproved(uint256 indexed requestId, address indexed student, uint256 indexed rewardId);
    event UseRequestRejected(uint256 indexed requestId);

    // ── Errors ──────────────────────────────────────────────────────────
    error NotProfessor();
    error NotStudent();
    error BadgeTypeNotFound(uint256 badgeTypeId);
    error TaskNotFound(uint256 taskId);
    error RewardNotFound(uint256 rewardId);
    error NotBadgeTypeOwner(uint256 badgeTypeId, address caller);
    error NotTaskOwner(uint256 taskId, address caller);
    error NotRewardOwner(uint256 rewardId, address caller);
    error AlreadyAwarded(address student, uint256 taskId);
    error TaskNotActive(uint256 taskId);
    error InsufficientBadges(uint256 available, uint256 required);
    error RewardOutOfSupply(uint256 rewardId);
    error RewardInactive(uint256 rewardId);
    error SoulboundTransferBlocked();
    error ZeroCost();
    error ZeroRewardAmount();
    error UseRequestNotFound(uint256 requestId);
    error InvalidUseRequestState(uint256 requestId, UseRequestStatus current);
    error NotRequestOwner(uint256 requestId);
    error InsufficientRewardTokens(uint256 rewardId);
    error NotAdmin();

    // ── Modifiers ───────────────────────────────────────────────────────

    modifier onlyProfessor() {
        if (!campusRoles.hasRole(campusRoles.PROFESSOR_ROLE(), msg.sender))
            revert NotProfessor();
        _;
    }

    modifier onlyProfessorOrAdmin() {
        if (!campusRoles.hasRole(campusRoles.PROFESSOR_ROLE(), msg.sender) &&
            !campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender))
            revert NotProfessor();
        _;
    }

    modifier onlyStudent() {
        if (!campusRoles.hasRole(campusRoles.STUDENT_ROLE(), msg.sender))
            revert NotStudent();
        _;
    }

    // ── Functions ───────────────────────────────────────────────────────

    // ── Constructor ─────────────────────────────────────────────────────

    constructor(address _campusRoles, string memory uri_) ERC1155(uri_) {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── External functions ──────────────────────────────────────────────

    // ── Badge type management ───────────────────────────────────────────

    /**
     * @dev Crea un nuevo tipo de insignia.
     */
    function createBadgeType() external onlyProfessorOrAdmin whenNotPaused returns (uint256 badgeTypeId) {
        badgeTypeId = nextBadgeTypeId;
        unchecked { ++nextBadgeTypeId; }

        _badgeTypes[badgeTypeId] = BadgeType({
            creator: msg.sender,
            exists: true
        });

        emit BadgeTypeCreated(badgeTypeId, msg.sender);
    }

    // ── Task management ─────────────────────────────────────────────────

    /**
     * @dev Crea una tarea vinculada a un tipo de insignia.
     *      Solo el creador del badgeType puede crear tareas para el.
     */
    function createTask(
        uint256 badgeTypeId,
        uint256 rewardAmount
    ) external onlyProfessorOrAdmin whenNotPaused returns (uint256 taskId) {
        if (!_badgeTypes[badgeTypeId].exists) revert BadgeTypeNotFound(badgeTypeId);
        if (_badgeTypes[badgeTypeId].creator != msg.sender)
            revert NotBadgeTypeOwner(badgeTypeId, msg.sender);
        if (rewardAmount == 0) revert ZeroRewardAmount();

        taskId = nextTaskId;
        unchecked { ++nextTaskId; }

        _tasks[taskId] = Task({
            badgeTypeId: badgeTypeId,
            rewardAmount: rewardAmount,
            professor: msg.sender,
            active: true
        });

        emit TaskCreated(taskId, badgeTypeId, msg.sender);
    }

    /**
     * @dev Desactiva una tarea (solo su creador).
     */
    function deactivateTask(uint256 taskId) external onlyProfessorOrAdmin {
        Task storage task = _tasks[taskId];
        if (task.professor == address(0)) revert TaskNotFound(taskId);
        if (task.professor != msg.sender) revert NotTaskOwner(taskId, msg.sender);

        task.active = false;
        emit TaskDeactivated(taskId);
    }

    // ── Badge awarding ──────────────────────────────────────────────────

    /**
     * @dev Otorga insignias a un estudiante por completar una tarea.
     */
    function awardBadge(uint256 taskId, address student) external onlyProfessorOrAdmin whenNotPaused {
        Task storage task = _tasks[taskId];
        if (task.professor == address(0)) revert TaskNotFound(taskId);
        if (task.professor != msg.sender) revert NotTaskOwner(taskId, msg.sender);
        if (!task.active) revert TaskNotActive(taskId);
        if (!campusRoles.hasRole(campusRoles.STUDENT_ROLE(), student))
            revert NotStudent();
        if (taskAwarded[student][taskId]) revert AlreadyAwarded(student, taskId);

        taskAwarded[student][taskId] = true;

        // Mintear insignias al estudiante
        _mint(student, task.badgeTypeId, task.rewardAmount, "");

        emit BadgeAwarded(taskId, student, task.badgeTypeId, task.rewardAmount);
    }

    // ── Reward management ───────────────────────────────────────────────

    /**
     * @dev Crea una recompensa canjeable con insignias.
     *      supply=0 significa ilimitado.
     */
    function createReward(
        uint256 badgeTypeId,
        uint256 badgeCost,
        uint256 supply
    ) external onlyProfessorOrAdmin returns (uint256 rewardId) {
        if (!_badgeTypes[badgeTypeId].exists) revert BadgeTypeNotFound(badgeTypeId);
        if (badgeCost == 0) revert ZeroCost();

        rewardId = nextRewardId;
        unchecked { ++nextRewardId; }

        _rewards[rewardId] = Reward({
            badgeTypeId: badgeTypeId,
            badgeCost: badgeCost,
            supply: supply,
            totalSupply: supply,
            professor: msg.sender,
            active: true
        });

        emit RewardCreated(rewardId, badgeCost, supply, msg.sender);
    }

    /**
     * @dev Desactiva una recompensa (solo su creador).
     */
    function deactivateReward(uint256 rewardId) external onlyProfessorOrAdmin {
        Reward storage reward = _rewards[rewardId];
        if (reward.professor == address(0)) revert RewardNotFound(rewardId);
        if (reward.professor != msg.sender) revert NotRewardOwner(rewardId, msg.sender);

        reward.active = false;
        emit RewardDeactivated(rewardId);
    }

    // ── Redemption ──────────────────────────────────────────────────────

    /**
     * @dev Canjea una recompensa quemando las insignias requeridas.
     */
    function redeemReward(uint256 rewardId) external onlyStudent whenNotPaused {
        Reward storage reward = _rewards[rewardId];
        if (reward.professor == address(0)) revert RewardNotFound(rewardId);
        if (!reward.active) revert RewardInactive(rewardId);

        // Verificar supply (0 = ilimitado)
        if (reward.totalSupply != 0 && reward.supply == 0)
            revert RewardOutOfSupply(rewardId);

        // Verificar que el estudiante tiene suficientes insignias
        uint256 studentBalance = balanceOf(msg.sender, reward.badgeTypeId);
        if (studentBalance < reward.badgeCost)
            revert InsufficientBadges(studentBalance, reward.badgeCost);

        // --- Effects ---
        if (reward.totalSupply != 0) {
            unchecked { reward.supply -= 1; }
        }

        uint256 redemptionId = nextRedemptionId;
        unchecked { ++nextRedemptionId; }

        _redemptions[redemptionId] = Redemption({
            student: msg.sender,
            rewardId: rewardId,
            timestamp: block.timestamp
        });
        _studentRedemptions[msg.sender].push(redemptionId);

        // --- Interactions ---
        // Quemar insignias del estudiante
        _burn(msg.sender, reward.badgeTypeId, reward.badgeCost);

        // Mintear token de recompensa al estudiante como voucher
        uint256 rewardTokenId = REWARD_TOKEN_OFFSET + rewardId;
        _mint(msg.sender, rewardTokenId, 1, "");

        emit RewardRedeemed(rewardId, msg.sender, reward.badgeTypeId, reward.badgeCost, redemptionId);
        emit RewardTokenMinted(rewardId, msg.sender, rewardTokenId);
    }

    // ── Reward use flow ─────────────────────────────────────────────────

    /**
     * @dev El estudiante solicita usar su token de recompensa.
     */
    function requestUseReward(uint256 rewardId) external onlyStudent returns (uint256 requestId) {
        if (_rewards[rewardId].professor == address(0)) revert RewardNotFound(rewardId);

        uint256 rewardTokenId = REWARD_TOKEN_OFFSET + rewardId;
        if (balanceOf(msg.sender, rewardTokenId) == 0) revert InsufficientRewardTokens(rewardId);

        requestId = nextUseRequestId;
        unchecked { ++nextUseRequestId; }

        _useRequests[requestId] = UseRequest({
            student: msg.sender,
            rewardId: rewardId,
            status: UseRequestStatus.Pending
        });
        _studentUseRequests[msg.sender].push(requestId);

        emit UseRequestCreated(requestId, msg.sender, rewardId);
    }

    /**
     * @dev El estudiante retira su solicitud de uso (solo si está Pending).
     */
    function cancelUseRequest(uint256 requestId) external onlyStudent {
        UseRequest storage req = _useRequests[requestId];
        if (req.student == address(0)) revert UseRequestNotFound(requestId);
        if (req.student != msg.sender) revert NotRequestOwner(requestId);
        if (req.status != UseRequestStatus.Pending)
            revert InvalidUseRequestState(requestId, req.status);

        req.status = UseRequestStatus.Cancelled;
        emit UseRequestCancelled(requestId);
    }

    /**
     * @dev El profesor aprueba el uso: quema el token de recompensa del estudiante.
     *      Solo puede aprobarlo el profesor que creó la recompensa.
     */
    function approveUseRequest(uint256 requestId) external onlyProfessorOrAdmin {
        UseRequest storage req = _useRequests[requestId];
        if (req.student == address(0)) revert UseRequestNotFound(requestId);
        if (req.status != UseRequestStatus.Pending)
            revert InvalidUseRequestState(requestId, req.status);

        Reward storage reward = _rewards[req.rewardId];
        if (reward.professor != msg.sender) revert NotRewardOwner(req.rewardId, msg.sender);

        address student = req.student;
        uint256 rewardId = req.rewardId;

        req.status = UseRequestStatus.Approved;

        uint256 rewardTokenId = REWARD_TOKEN_OFFSET + rewardId;
        _burn(student, rewardTokenId, 1);

        emit UseRequestApproved(requestId, student, rewardId);
    }

    /**
     * @dev El profesor rechaza la solicitud de uso. El token queda con el estudiante.
     *      Solo puede rechazarlo el profesor que creó la recompensa.
     */
    function rejectUseRequest(uint256 requestId) external onlyProfessorOrAdmin {
        UseRequest storage req = _useRequests[requestId];
        if (req.student == address(0)) revert UseRequestNotFound(requestId);
        if (req.status != UseRequestStatus.Pending)
            revert InvalidUseRequestState(requestId, req.status);

        Reward storage reward = _rewards[req.rewardId];
        if (reward.professor != msg.sender) revert NotRewardOwner(req.rewardId, msg.sender);

        req.status = UseRequestStatus.Rejected;
        emit UseRequestRejected(requestId);
    }

    /// @notice Pausa el contrato (solo admin)
    function pause() external {
        if (!campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender))
            revert NotAdmin();
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external {
        if (!campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender))
            revert NotAdmin();
        _unpause();
    }

    // ── External view functions ─────────────────────────────────────────

    function getBadgeType(uint256 badgeTypeId) external view returns (BadgeType memory) {
        return _badgeTypes[badgeTypeId];
    }

    function getTask(uint256 taskId) external view returns (Task memory) {
        return _tasks[taskId];
    }

    function getReward(uint256 rewardId) external view returns (Reward memory) {
        return _rewards[rewardId];
    }

    function getBadgeBalance(address student, uint256 badgeTypeId) external view returns (uint256) {
        return balanceOf(student, badgeTypeId);
    }

    function getStudentRedemptions(address student) external view returns (uint256[] memory) {
        return _studentRedemptions[student];
    }

    function getRedemption(uint256 redemptionId) external view returns (Redemption memory) {
        return _redemptions[redemptionId];
    }

    function getUseRequest(uint256 requestId) external view returns (UseRequest memory) {
        return _useRequests[requestId];
    }

    function getStudentUseRequests(address student) external view returns (uint256[] memory) {
        return _studentUseRequests[student];
    }

    function getRewardTokenId(uint256 rewardId) external pure returns (uint256) {
        return REWARD_TOKEN_OFFSET + rewardId;
    }

    // ── Public pure functions ───────────────────────────────────────────

    /**
     * @dev Solo permite mint (from=0) y burn (to=0). Bloquea transferencias.
     *      OZ v5: _update reemplaza a _beforeTokenTransfer (firma sin operator ni data).
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        if (from != address(0) && to != address(0)) {
            revert SoulboundTransferBlocked();
        }
        super._update(from, to, ids, values);
    }

    /**
     * @dev Override: bloquea todas las transferencias.
     */
    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert SoulboundTransferBlocked();
    }

    /**
     * @dev Override: bloquea todas las transferencias batch.
     */
    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert SoulboundTransferBlocked();
    }

    /**
     * @dev Override: bloquea approval (no tiene sentido sin transferencias).
     */
    function setApprovalForAll(address, bool) public pure override {
        revert SoulboundTransferBlocked();
    }

    /**
     * @dev Override: isApprovedForAll siempre false.
     */
    function isApprovedForAll(address, address) public pure override returns (bool) {
        return false;
    }
}
