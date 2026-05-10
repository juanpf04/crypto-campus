// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { CampusRoles } from "./CampusRoles.sol";

/// @title BadgeSystem
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Sistema de insignias academicas soulbound no transferibles, organizadas por asignatura.
/// @dev Profesores crean assignments con varios premios y recompensas. Estudiantes ganan insignias
///      por asignatura y las canjean por recompensas.
contract BadgeSystem is ERC1155, ERC1155Supply, Pausable {
    // ── Type declarations ───────────────────────────────────────────────

    /// @notice Referencia al control de acceso del campus
    CampusRoles public immutable campusRoles;

    /// @notice Insignia asociada a una asignatura. Una por SubjectOffering.
    /// @dev El subjectBadgeId es el tokenId del ERC-1155 que reciben los alumnos.
    struct SubjectBadge {
        address professor;
        bool exists;
    }

    enum AssignmentStatus { None, Open, Reviewing, Closed }

    /// @notice Tarea/practica que un profesor publica en una asignatura.
    struct Assignment {
        uint256 subjectBadgeId;
        address professor;
        AssignmentStatus status;
    }

    /// @notice Cada premio dentro de una assignment (ej. mejor nota, mejor diseño).
    struct PrizeCategory {
        uint256 assignmentId;
        uint256 badgeReward;
        uint256 maxWinners;
        uint256 currentWinners;
    }

    /// @notice Recompensa canjeable. Vinculada a la insignia de una asignatura.
    struct Reward {
        uint256 subjectBadgeId;
        uint256 badgeCost;
        uint256 supply;        // remanente (0 = ilimitado si totalSupply==0)
        uint256 totalSupply;   // 0 = ilimitado
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

    uint256 public nextSubjectBadgeId = 1;
    mapping(uint256 => SubjectBadge) private _subjectBadges;

    uint256 public nextAssignmentId = 1;
    mapping(uint256 => Assignment) private _assignments;

    uint256 public nextPrizeCategoryId = 1;
    mapping(uint256 => PrizeCategory) private _prizeCategories;

    uint256 public nextRewardId = 1;
    mapping(uint256 => Reward) private _rewards;

    /// @notice Evita que un alumno reciba dos veces el mismo premio.
    mapping(address => mapping(uint256 => bool)) public prizeAwarded;

    uint256 public nextRedemptionId = 1;
    mapping(uint256 => Redemption) private _redemptions;
    mapping(address => uint256[]) private _studentRedemptions;

    uint256 public nextUseRequestId = 1;
    mapping(uint256 => UseRequest) private _useRequests;
    mapping(address => uint256[]) private _studentUseRequests;

    // ── Events ──────────────────────────────────────────────────────────
    event SubjectBadgeCreated(uint256 indexed subjectBadgeId, address indexed professor);
    event AssignmentCreated(uint256 indexed assignmentId, uint256 indexed subjectBadgeId, address indexed professor);
    event AssignmentStatusChanged(uint256 indexed assignmentId, AssignmentStatus status);
    event PrizeCategoryCreated(
        uint256 indexed prizeCategoryId,
        uint256 indexed assignmentId,
        uint256 badgeReward,
        uint256 maxWinners
    );
    event PrizeAwarded(
        uint256 indexed prizeCategoryId,
        address indexed student,
        uint256 indexed subjectBadgeId,
        uint256 amount
    );

    event RewardCreated(uint256 indexed rewardId, uint256 badgeCost, uint256 supply, address indexed professor);
    event RewardDeactivated(uint256 indexed rewardId);
    event RewardActivated(uint256 indexed rewardId);
    event RewardRedeemed(
        uint256 indexed rewardId,
        address indexed student,
        uint256 indexed subjectBadgeId,
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
    error NotAdmin();
    error SubjectBadgeNotFound(uint256 subjectBadgeId);
    error AssignmentNotFound(uint256 assignmentId);
    error PrizeCategoryNotFound(uint256 prizeCategoryId);
    error RewardNotFound(uint256 rewardId);
    error NotSubjectBadgeOwner(uint256 subjectBadgeId, address caller);
    error NotAssignmentOwner(uint256 assignmentId, address caller);
    error NotRewardOwner(uint256 rewardId, address caller);
    error AlreadyAwardedPrize(address student, uint256 prizeCategoryId);
    error InvalidAssignmentStatus(uint256 assignmentId, AssignmentStatus current);
    error MaxWinnersReached(uint256 prizeCategoryId);
    error InsufficientBadges(uint256 available, uint256 required);
    error RewardOutOfSupply(uint256 rewardId);
    error RewardInactive(uint256 rewardId);
    error RewardAlreadyActive(uint256 rewardId);
    error SoulboundTransferBlocked();
    error ZeroCost();
    error ZeroBadgeReward();
    error ZeroMaxWinners();
    error EmptyWinnersList();
    error UseRequestNotFound(uint256 requestId);
    error InvalidUseRequestState(uint256 requestId, UseRequestStatus current);
    error NotRequestOwner(uint256 requestId);
    error InsufficientRewardTokens(uint256 rewardId);

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

    // ── Constructor ─────────────────────────────────────────────────────

    constructor(address _campusRoles, string memory uri_) ERC1155(uri_) {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── Subject badge management ────────────────────────────────────────

    /**
     * @dev Crea la insignia de una asignatura. Una por SubjectOffering en Prisma.
     *      Se llama una sola vez por asignatura, normalmente al crear la primera assignment.
     */
    function createSubjectBadge() external onlyProfessorOrAdmin whenNotPaused returns (uint256 subjectBadgeId) {
        subjectBadgeId = nextSubjectBadgeId;
        unchecked { ++nextSubjectBadgeId; }

        _subjectBadges[subjectBadgeId] = SubjectBadge({
            professor: msg.sender,
            exists: true
        });

        emit SubjectBadgeCreated(subjectBadgeId, msg.sender);
    }

    // ── Assignment management ───────────────────────────────────────────

    /**
     * @dev Crea una assignment (tarea) en una asignatura. El profesor debe ser
     *      el creador del subjectBadge.
     */
    function createAssignment(
        uint256 subjectBadgeId
    ) external onlyProfessorOrAdmin whenNotPaused returns (uint256 assignmentId) {
        SubjectBadge storage badge = _subjectBadges[subjectBadgeId];
        if (!badge.exists) revert SubjectBadgeNotFound(subjectBadgeId);
        if (badge.professor != msg.sender) revert NotSubjectBadgeOwner(subjectBadgeId, msg.sender);

        assignmentId = nextAssignmentId;
        unchecked { ++nextAssignmentId; }

        _assignments[assignmentId] = Assignment({
            subjectBadgeId: subjectBadgeId,
            professor: msg.sender,
            status: AssignmentStatus.Open
        });

        emit AssignmentCreated(assignmentId, subjectBadgeId, msg.sender);
    }

    /**
     * @dev Añade una categoría de premio a una assignment. Solo se puede mientras
     *      la assignment esté abierta.
     */
    function addPrizeCategory(
        uint256 assignmentId,
        uint256 badgeReward,
        uint256 maxWinners
    ) external onlyProfessorOrAdmin whenNotPaused returns (uint256 prizeCategoryId) {
        Assignment storage assignment = _assignments[assignmentId];
        if (assignment.professor == address(0)) revert AssignmentNotFound(assignmentId);
        if (assignment.professor != msg.sender) revert NotAssignmentOwner(assignmentId, msg.sender);
        if (assignment.status != AssignmentStatus.Open)
            revert InvalidAssignmentStatus(assignmentId, assignment.status);
        if (badgeReward == 0) revert ZeroBadgeReward();
        if (maxWinners == 0) revert ZeroMaxWinners();

        prizeCategoryId = nextPrizeCategoryId;
        unchecked { ++nextPrizeCategoryId; }

        _prizeCategories[prizeCategoryId] = PrizeCategory({
            assignmentId: assignmentId,
            badgeReward: badgeReward,
            maxWinners: maxWinners,
            currentWinners: 0
        });

        emit PrizeCategoryCreated(prizeCategoryId, assignmentId, badgeReward, maxWinners);
    }

    /**
     * @dev Cierra una assignment para entregas: pasa a Reviewing.
     *      Los alumnos ya no pueden entregar pero el profe sí puede otorgar premios.
     */
    function closeAssignmentForReview(uint256 assignmentId) external onlyProfessorOrAdmin whenNotPaused {
        Assignment storage assignment = _assignments[assignmentId];
        if (assignment.professor == address(0)) revert AssignmentNotFound(assignmentId);
        if (assignment.professor != msg.sender) revert NotAssignmentOwner(assignmentId, msg.sender);
        if (assignment.status != AssignmentStatus.Open)
            revert InvalidAssignmentStatus(assignmentId, assignment.status);

        assignment.status = AssignmentStatus.Reviewing;
        emit AssignmentStatusChanged(assignmentId, AssignmentStatus.Reviewing);
    }

    /**
     * @dev Cierra definitivamente una assignment. Ya no se pueden otorgar más premios.
     */
    function closeAssignment(uint256 assignmentId) external onlyProfessorOrAdmin whenNotPaused {
        Assignment storage assignment = _assignments[assignmentId];
        if (assignment.professor == address(0)) revert AssignmentNotFound(assignmentId);
        if (assignment.professor != msg.sender) revert NotAssignmentOwner(assignmentId, msg.sender);
        if (assignment.status == AssignmentStatus.Closed)
            revert InvalidAssignmentStatus(assignmentId, assignment.status);

        assignment.status = AssignmentStatus.Closed;
        emit AssignmentStatusChanged(assignmentId, AssignmentStatus.Closed);
    }

    // ── Prize awarding ──────────────────────────────────────────────────

    /**
     * @dev Otorga un premio a múltiples alumnos en una sola tx.
     *      Solo válido cuando la assignment está Open o Reviewing.
     */
    function awardPrize(
        uint256 prizeCategoryId,
        address[] calldata winners
    ) external onlyProfessorOrAdmin whenNotPaused {
        if (winners.length == 0) revert EmptyWinnersList();

        PrizeCategory storage prize = _prizeCategories[prizeCategoryId];
        if (prize.assignmentId == 0) revert PrizeCategoryNotFound(prizeCategoryId);

        Assignment storage assignment = _assignments[prize.assignmentId];
        if (assignment.professor != msg.sender) revert NotAssignmentOwner(prize.assignmentId, msg.sender);
        if (assignment.status == AssignmentStatus.Closed)
            revert InvalidAssignmentStatus(prize.assignmentId, assignment.status);

        if (prize.currentWinners + winners.length > prize.maxWinners)
            revert MaxWinnersReached(prizeCategoryId);

        bytes32 studentRole = campusRoles.STUDENT_ROLE();
        uint256 subjectBadgeId = assignment.subjectBadgeId;

        for (uint256 i = 0; i < winners.length; i++) {
            address student = winners[i];
            if (!campusRoles.hasRole(studentRole, student)) revert NotStudent();
            if (prizeAwarded[student][prizeCategoryId])
                revert AlreadyAwardedPrize(student, prizeCategoryId);

            prizeAwarded[student][prizeCategoryId] = true;
            _mint(student, subjectBadgeId, prize.badgeReward, "");

            emit PrizeAwarded(prizeCategoryId, student, subjectBadgeId, prize.badgeReward);
        }

        unchecked { prize.currentWinners += winners.length; }
    }

    // ── Reward management ───────────────────────────────────────────────

    /**
     * @dev Crea una recompensa canjeable con insignias de una asignatura.
     *      supply=0 significa ilimitado.
     */
    function createReward(
        uint256 subjectBadgeId,
        uint256 badgeCost,
        uint256 supply
    ) external onlyProfessorOrAdmin whenNotPaused returns (uint256 rewardId) {
        SubjectBadge storage badge = _subjectBadges[subjectBadgeId];
        if (!badge.exists) revert SubjectBadgeNotFound(subjectBadgeId);
        if (badgeCost == 0) revert ZeroCost();

        rewardId = nextRewardId;
        unchecked { ++nextRewardId; }

        _rewards[rewardId] = Reward({
            subjectBadgeId: subjectBadgeId,
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
    function deactivateReward(uint256 rewardId) external onlyProfessorOrAdmin whenNotPaused {
        Reward storage reward = _rewards[rewardId];
        if (reward.professor == address(0)) revert RewardNotFound(rewardId);
        if (reward.professor != msg.sender) revert NotRewardOwner(rewardId, msg.sender);

        reward.active = false;
        emit RewardDeactivated(rewardId);
    }

    /**
     * @dev Reactiva una recompensa previamente desactivada (solo su creador).
     */
    function activateReward(uint256 rewardId) external onlyProfessorOrAdmin whenNotPaused {
        Reward storage reward = _rewards[rewardId];
        if (reward.professor == address(0)) revert RewardNotFound(rewardId);
        if (reward.professor != msg.sender) revert NotRewardOwner(rewardId, msg.sender);
        if (reward.active) revert RewardAlreadyActive(rewardId);

        reward.active = true;
        emit RewardActivated(rewardId);
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

        // Verificar balance de insignias
        uint256 studentBalance = balanceOf(msg.sender, reward.subjectBadgeId);
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
        _burn(msg.sender, reward.subjectBadgeId, reward.badgeCost);

        uint256 rewardTokenId = REWARD_TOKEN_OFFSET + rewardId;
        _mint(msg.sender, rewardTokenId, 1, "");

        emit RewardRedeemed(rewardId, msg.sender, reward.subjectBadgeId, reward.badgeCost, redemptionId);
        emit RewardTokenMinted(rewardId, msg.sender, rewardTokenId);
    }

    // ── Reward use flow ─────────────────────────────────────────────────

    function requestUseReward(uint256 rewardId) external onlyStudent whenNotPaused returns (uint256 requestId) {
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

    function cancelUseRequest(uint256 requestId) external onlyStudent whenNotPaused {
        UseRequest storage req = _useRequests[requestId];
        if (req.student == address(0)) revert UseRequestNotFound(requestId);
        if (req.student != msg.sender) revert NotRequestOwner(requestId);
        if (req.status != UseRequestStatus.Pending)
            revert InvalidUseRequestState(requestId, req.status);

        req.status = UseRequestStatus.Cancelled;
        emit UseRequestCancelled(requestId);
    }

    function approveUseRequest(uint256 requestId) external onlyProfessorOrAdmin whenNotPaused {
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

    function rejectUseRequest(uint256 requestId) external onlyProfessorOrAdmin whenNotPaused {
        UseRequest storage req = _useRequests[requestId];
        if (req.student == address(0)) revert UseRequestNotFound(requestId);
        if (req.status != UseRequestStatus.Pending)
            revert InvalidUseRequestState(requestId, req.status);

        Reward storage reward = _rewards[req.rewardId];
        if (reward.professor != msg.sender) revert NotRewardOwner(req.rewardId, msg.sender);

        req.status = UseRequestStatus.Rejected;
        emit UseRequestRejected(requestId);
    }

    // ── Pause control ───────────────────────────────────────────────────

    function pause() external {
        if (!campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender)) revert NotAdmin();
        _pause();
    }

    function unpause() external {
        if (!campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender)) revert NotAdmin();
        _unpause();
    }

    // ── External view functions ─────────────────────────────────────────

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getSubjectBadge(uint256 subjectBadgeId) external view returns (SubjectBadge memory) {
        return _subjectBadges[subjectBadgeId];
    }

    function getAssignment(uint256 assignmentId) external view returns (Assignment memory) {
        return _assignments[assignmentId];
    }

    function getPrizeCategory(uint256 prizeCategoryId) external view returns (PrizeCategory memory) {
        return _prizeCategories[prizeCategoryId];
    }

    function getReward(uint256 rewardId) external view returns (Reward memory) {
        return _rewards[rewardId];
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getBadgeBalance(address student, uint256 subjectBadgeId) external view returns (uint256) {
        return balanceOf(student, subjectBadgeId);
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getStudentRedemptions(address student) external view returns (uint256[] memory) {
        return _studentRedemptions[student];
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getRedemption(uint256 redemptionId) external view returns (Redemption memory) {
        return _redemptions[redemptionId];
    }

    function getUseRequest(uint256 requestId) external view returns (UseRequest memory) {
        return _useRequests[requestId];
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getStudentUseRequests(address student) external view returns (uint256[] memory) {
        return _studentUseRequests[student];
    }

    function getRewardTokenId(uint256 rewardId) external pure returns (uint256) {
        return REWARD_TOKEN_OFFSET + rewardId;
    }

    // ── Soulbound enforcement ───────────────────────────────────────────

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

    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert SoulboundTransferBlocked();
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert SoulboundTransferBlocked();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert SoulboundTransferBlocked();
    }

    function isApprovedForAll(address, address) public pure override returns (bool) {
        return false;
    }
}
