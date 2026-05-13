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

    /// @notice Estados posibles de una assignment
    enum AssignmentStatus { None, Open, Reviewing, Closed }

    /// @notice Tarea/practica que un profesor publica en una asignatura
    struct Assignment {
        uint256 subjectBadgeId;
        address professor;
        AssignmentStatus status;
    }

    /// @notice Cada premio dentro de una assignment (p.ej. mejor nota, mejor diseno)
    struct PrizeCategory {
        uint256 assignmentId;
        uint256 badgeReward;
        uint256 maxWinners;
        uint256 currentWinners;
    }

    /// @notice Recompensa canjeable vinculada a la insignia de una asignatura
    /// @dev `supply` es el remanente actual; `totalSupply` es el limite inicial.
    ///      `totalSupply == 0` indica supply ilimitado.
    struct Reward {
        uint256 subjectBadgeId;
        uint256 badgeCost;
        uint256 supply;
        uint256 totalSupply;
        address professor;
        bool active;
    }

    /// @notice Registro de un canje de recompensa
    struct Redemption {
        address student;
        uint256 rewardId;
        uint256 timestamp;
    }

    /// @notice Estados posibles de una solicitud de uso de recompensa
    enum UseRequestStatus { None, Pending, Approved, Rejected, Cancelled }

    /// @notice Solicitud de uso de una recompensa por parte de un estudiante
    struct UseRequest {
        address student;
        uint256 rewardId;
        UseRequestStatus status;
    }

    // ── State variables ─────────────────────────────────────────────────

    /// @notice Offset aplicado al rewardId para calcular el token ID del recibo de canje
    uint256 public constant REWARD_TOKEN_OFFSET = 1_000_000;

    /// @notice Contador autoincremental de subject badges
    uint256 public nextSubjectBadgeId = 1;
    /// @dev Registro de subject badges por ID
    mapping(uint256 => SubjectBadge) private _subjectBadges;

    /// @notice Contador autoincremental de assignments
    uint256 public nextAssignmentId = 1;
    /// @dev Registro de assignments por ID
    mapping(uint256 => Assignment) private _assignments;

    /// @notice Contador autoincremental de categorias de premio
    uint256 public nextPrizeCategoryId = 1;
    /// @dev Registro de categorias de premio por ID
    mapping(uint256 => PrizeCategory) private _prizeCategories;

    /// @notice Contador autoincremental de recompensas
    uint256 public nextRewardId = 1;
    /// @dev Registro de recompensas por ID
    mapping(uint256 => Reward) private _rewards;

    /// @notice Evita que un alumno reciba dos veces el mismo premio
    mapping(address => mapping(uint256 => bool)) public prizeAwarded;

    /// @notice Contador autoincremental de canjes
    uint256 public nextRedemptionId = 1;
    /// @dev Registro de canjes por ID
    mapping(uint256 => Redemption) private _redemptions;
    /// @dev Historico de canjes por estudiante
    mapping(address => uint256[]) private _studentRedemptions;

    /// @notice Contador autoincremental de solicitudes de uso
    uint256 public nextUseRequestId = 1;
    /// @dev Registro de solicitudes de uso por ID
    mapping(uint256 => UseRequest) private _useRequests;
    /// @dev Historico de solicitudes de uso por estudiante
    mapping(address => uint256[]) private _studentUseRequests;

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Se emite al crear la insignia de una asignatura
    /// @param subjectBadgeId ID del subject badge creado
    /// @param professor Direccion del profesor creador
    event SubjectBadgeCreated(uint256 indexed subjectBadgeId, address indexed professor);

    /// @notice Se emite al crear una assignment dentro de una asignatura
    /// @param assignmentId ID de la assignment creada
    /// @param subjectBadgeId Subject badge asociado
    /// @param professor Direccion del profesor creador
    event AssignmentCreated(uint256 indexed assignmentId, uint256 indexed subjectBadgeId, address indexed professor);

    /// @notice Se emite al cambiar el estado de una assignment
    /// @param assignmentId ID de la assignment
    /// @param status Nuevo estado
    event AssignmentStatusChanged(uint256 indexed assignmentId, AssignmentStatus status);

    /// @notice Se emite al crear una categoria de premio en una assignment
    /// @param prizeCategoryId ID de la categoria de premio
    /// @param assignmentId Assignment a la que pertenece
    /// @param badgeReward Cantidad de badges otorgados por premio
    /// @param maxWinners Numero maximo de ganadores
    event PrizeCategoryCreated(
        uint256 indexed prizeCategoryId,
        uint256 indexed assignmentId,
        uint256 badgeReward,
        uint256 maxWinners
    );

    /// @notice Se emite al otorgar un premio a un estudiante
    /// @param prizeCategoryId Categoria de premio otorgada
    /// @param student Direccion del estudiante premiado
    /// @param subjectBadgeId Subject badge otorgado
    /// @param amount Cantidad de badges minteados
    event PrizeAwarded(
        uint256 indexed prizeCategoryId,
        address indexed student,
        uint256 indexed subjectBadgeId,
        uint256 amount
    );

    /// @notice Se emite al crear una recompensa canjeable
    /// @param rewardId ID de la recompensa
    /// @param badgeCost Coste en badges para canjear
    /// @param supply Supply inicial (0 = ilimitado)
    /// @param professor Direccion del profesor creador
    event RewardCreated(uint256 indexed rewardId, uint256 badgeCost, uint256 supply, address indexed professor);

    /// @notice Se emite al desactivar una recompensa
    /// @param rewardId ID de la recompensa desactivada
    event RewardDeactivated(uint256 indexed rewardId);

    /// @notice Se emite al reactivar una recompensa
    /// @param rewardId ID de la recompensa reactivada
    event RewardActivated(uint256 indexed rewardId);

    /// @notice Se emite al canjear una recompensa
    /// @param rewardId ID de la recompensa canjeada
    /// @param student Direccion del estudiante
    /// @param subjectBadgeId Subject badge consumido
    /// @param badgesBurned Cantidad de badges quemados
    /// @param redemptionId ID del canje creado
    event RewardRedeemed(
        uint256 indexed rewardId,
        address indexed student,
        uint256 indexed subjectBadgeId,
        uint256 badgesBurned,
        uint256 redemptionId
    );

    /// @notice Se emite al mintear el NFT recibo de canje
    /// @param rewardId ID de la recompensa
    /// @param student Direccion del estudiante
    /// @param tokenId Token ID del recibo minteado
    event RewardTokenMinted(uint256 indexed rewardId, address indexed student, uint256 tokenId);

    /// @notice Se emite al crear una solicitud de uso de recompensa
    /// @param requestId ID de la solicitud
    /// @param student Direccion del estudiante
    /// @param rewardId Recompensa cuyo uso se solicita
    event UseRequestCreated(uint256 indexed requestId, address indexed student, uint256 indexed rewardId);

    /// @notice Se emite al cancelar una solicitud de uso
    /// @param requestId ID de la solicitud cancelada
    event UseRequestCancelled(uint256 indexed requestId);

    /// @notice Se emite al aprobar una solicitud de uso
    /// @param requestId ID de la solicitud aprobada
    /// @param student Direccion del estudiante
    /// @param rewardId Recompensa aprobada
    event UseRequestApproved(uint256 indexed requestId, address indexed student, uint256 indexed rewardId);

    /// @notice Se emite al rechazar una solicitud de uso
    /// @param requestId ID de la solicitud rechazada
    event UseRequestRejected(uint256 indexed requestId);

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice Caller sin rol professor
    error NotProfessor();
    /// @notice Caller sin rol student
    error NotStudent();
    /// @notice Caller sin rol admin
    error NotAdmin();
    /// @notice El subject badge no existe
    /// @param subjectBadgeId ID solicitado
    error SubjectBadgeNotFound(uint256 subjectBadgeId);
    /// @notice La assignment no existe
    /// @param assignmentId ID solicitado
    error AssignmentNotFound(uint256 assignmentId);
    /// @notice La categoria de premio no existe
    /// @param prizeCategoryId ID solicitado
    error PrizeCategoryNotFound(uint256 prizeCategoryId);
    /// @notice La recompensa no existe
    /// @param rewardId ID solicitado
    error RewardNotFound(uint256 rewardId);
    /// @notice El caller no es el propietario del subject badge
    /// @param subjectBadgeId ID del subject badge
    /// @param caller Direccion que intenta operar
    error NotSubjectBadgeOwner(uint256 subjectBadgeId, address caller);
    /// @notice El caller no es el propietario de la assignment
    /// @param assignmentId ID de la assignment
    /// @param caller Direccion que intenta operar
    error NotAssignmentOwner(uint256 assignmentId, address caller);
    /// @notice El caller no es el propietario de la recompensa
    /// @param rewardId ID de la recompensa
    /// @param caller Direccion que intenta operar
    error NotRewardOwner(uint256 rewardId, address caller);
    /// @notice El estudiante ya recibio este premio
    /// @param student Direccion del estudiante
    /// @param prizeCategoryId ID de la categoria de premio
    error AlreadyAwardedPrize(address student, uint256 prizeCategoryId);
    /// @notice La assignment no esta en un estado valido para la operacion
    /// @param assignmentId ID de la assignment
    /// @param current Estado actual
    error InvalidAssignmentStatus(uint256 assignmentId, AssignmentStatus current);
    /// @notice Se ha alcanzado el numero maximo de ganadores
    /// @param prizeCategoryId ID de la categoria de premio
    error MaxWinnersReached(uint256 prizeCategoryId);
    /// @notice El estudiante no tiene suficientes badges para canjear
    /// @param available Badges disponibles
    /// @param required Badges requeridos
    error InsufficientBadges(uint256 available, uint256 required);
    /// @notice La recompensa no tiene supply disponible
    /// @param rewardId ID de la recompensa
    error RewardOutOfSupply(uint256 rewardId);
    /// @notice La recompensa esta desactivada
    /// @param rewardId ID de la recompensa
    error RewardInactive(uint256 rewardId);
    /// @notice La recompensa ya estaba activa
    /// @param rewardId ID de la recompensa
    error RewardAlreadyActive(uint256 rewardId);
    /// @notice Las insignias son soulbound y no pueden transferirse
    error SoulboundTransferBlocked();
    /// @notice El coste de la recompensa no puede ser cero
    error ZeroCost();
    /// @notice La cantidad de badges del premio no puede ser cero
    error ZeroBadgeReward();
    /// @notice El numero maximo de ganadores no puede ser cero
    error ZeroMaxWinners();
    /// @notice La lista de ganadores esta vacia
    error EmptyWinnersList();
    /// @notice La solicitud de uso no existe
    /// @param requestId ID de la solicitud
    error UseRequestNotFound(uint256 requestId);
    /// @notice La solicitud de uso no esta en un estado valido
    /// @param requestId ID de la solicitud
    /// @param current Estado actual
    error InvalidUseRequestState(uint256 requestId, UseRequestStatus current);
    /// @notice El caller no es el propietario de la solicitud
    /// @param requestId ID de la solicitud
    error NotRequestOwner(uint256 requestId);
    /// @notice El estudiante no posee el recibo de canje requerido
    /// @param rewardId ID de la recompensa asociada
    error InsufficientRewardTokens(uint256 rewardId);

    // ── Modifiers ───────────────────────────────────────────────────────

    /// @notice Restringe la ejecucion a profesores
    modifier onlyProfessor() {
        if (!campusRoles.isProfessor(msg.sender))
            revert NotProfessor();
        _;
    }

    /// @notice Restringe la ejecucion a profesores o admins
    modifier onlyProfessorOrAdmin() {
        if (!campusRoles.isProfessor(msg.sender) && !campusRoles.isAdmin(msg.sender))
            revert NotProfessor();
        _;
    }

    /// @notice Restringe la ejecucion a estudiantes
    modifier onlyStudent() {
        if (!campusRoles.isStudent(msg.sender))
            revert NotStudent();
        _;
    }

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Inicializa el sistema de insignias con sus dependencias
    /// @param _campusRoles Direccion del contrato CampusRoles
    /// @param uri_ URI base para los metadatos ERC-1155
    constructor(address _campusRoles, string memory uri_) ERC1155(uri_) {
        campusRoles = CampusRoles(_campusRoles);
    }

    // ── Subject badge management ────────────────────────────────────────

    /// @notice Crea la insignia de una asignatura
    /// @dev Una por SubjectOffering en Prisma. Se llama una sola vez por asignatura,
    ///      normalmente al crear la primera assignment.
    /// @return subjectBadgeId ID del subject badge creado
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

    /// @notice Crea una assignment (tarea) en una asignatura
    /// @dev El profesor debe ser el creador del subjectBadge.
    /// @param subjectBadgeId ID del subject badge sobre el que se crea la assignment
    /// @return assignmentId ID de la assignment creada
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

    /// @notice Anade una categoria de premio a una assignment
    /// @dev Solo se puede mientras la assignment este abierta.
    /// @param assignmentId ID de la assignment
    /// @param badgeReward Cantidad de badges otorgados por premio
    /// @param maxWinners Numero maximo de ganadores
    /// @return prizeCategoryId ID de la categoria creada
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

    /// @notice Cierra una assignment para entregas (pasa a Reviewing)
    /// @dev Los alumnos ya no pueden entregar pero el profe si puede otorgar premios.
    /// @param assignmentId ID de la assignment
    function closeAssignmentForReview(uint256 assignmentId) external onlyProfessorOrAdmin whenNotPaused {
        Assignment storage assignment = _assignments[assignmentId];
        if (assignment.professor == address(0)) revert AssignmentNotFound(assignmentId);
        if (assignment.professor != msg.sender) revert NotAssignmentOwner(assignmentId, msg.sender);
        if (assignment.status != AssignmentStatus.Open)
            revert InvalidAssignmentStatus(assignmentId, assignment.status);

        assignment.status = AssignmentStatus.Reviewing;
        emit AssignmentStatusChanged(assignmentId, AssignmentStatus.Reviewing);
    }

    /// @notice Cierra definitivamente una assignment
    /// @dev Ya no se pueden otorgar mas premios tras esta llamada.
    /// @param assignmentId ID de la assignment
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

    /// @notice Otorga un premio a multiples alumnos en una sola tx
    /// @dev Solo valido cuando la assignment esta Open o Reviewing.
    /// @param prizeCategoryId Categoria de premio a otorgar
    /// @param winners Array de direcciones de estudiantes ganadores
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

        uint256 subjectBadgeId = assignment.subjectBadgeId;

        for (uint256 i = 0; i < winners.length; i++) {
            address student = winners[i];
            if (!campusRoles.isStudent(student)) revert NotStudent();
            if (prizeAwarded[student][prizeCategoryId])
                revert AlreadyAwardedPrize(student, prizeCategoryId);

            prizeAwarded[student][prizeCategoryId] = true;
            _mint(student, subjectBadgeId, prize.badgeReward, "");

            emit PrizeAwarded(prizeCategoryId, student, subjectBadgeId, prize.badgeReward);
        }

        unchecked { prize.currentWinners += winners.length; }
    }

    // ── Reward management ───────────────────────────────────────────────

    /// @notice Crea una recompensa canjeable con insignias de una asignatura
    /// @dev `supply == 0` significa supply ilimitado.
    /// @param subjectBadgeId Subject badge cuyas insignias canjean esta recompensa
    /// @param badgeCost Coste en badges para canjear (> 0)
    /// @param supply Supply inicial (0 = ilimitado)
    /// @return rewardId ID de la recompensa creada
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

    /// @notice Desactiva una recompensa (solo su creador)
    /// @param rewardId ID de la recompensa
    function deactivateReward(uint256 rewardId) external onlyProfessorOrAdmin whenNotPaused {
        Reward storage reward = _rewards[rewardId];
        if (reward.professor == address(0)) revert RewardNotFound(rewardId);
        if (reward.professor != msg.sender) revert NotRewardOwner(rewardId, msg.sender);

        reward.active = false;
        emit RewardDeactivated(rewardId);
    }

    /// @notice Reactiva una recompensa previamente desactivada (solo su creador)
    /// @param rewardId ID de la recompensa
    function activateReward(uint256 rewardId) external onlyProfessorOrAdmin whenNotPaused {
        Reward storage reward = _rewards[rewardId];
        if (reward.professor == address(0)) revert RewardNotFound(rewardId);
        if (reward.professor != msg.sender) revert NotRewardOwner(rewardId, msg.sender);
        if (reward.active) revert RewardAlreadyActive(rewardId);

        reward.active = true;
        emit RewardActivated(rewardId);
    }

    // ── Redemption ──────────────────────────────────────────────────────

    /// @notice Canjea una recompensa quemando las insignias requeridas
    /// @param rewardId ID de la recompensa a canjear
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

    /// @notice El estudiante solicita usar una recompensa previamente canjeada
    /// @param rewardId ID de la recompensa
    /// @return requestId ID de la solicitud creada
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

    /// @notice El estudiante cancela una solicitud de uso pendiente
    /// @param requestId ID de la solicitud
    function cancelUseRequest(uint256 requestId) external onlyStudent whenNotPaused {
        UseRequest storage req = _useRequests[requestId];
        if (req.student == address(0)) revert UseRequestNotFound(requestId);
        if (req.student != msg.sender) revert NotRequestOwner(requestId);
        if (req.status != UseRequestStatus.Pending)
            revert InvalidUseRequestState(requestId, req.status);

        req.status = UseRequestStatus.Cancelled;
        emit UseRequestCancelled(requestId);
    }

    /// @notice El profesor (creador de la recompensa) aprueba la solicitud de uso
    /// @dev Quema el NFT recibo de canje del estudiante
    /// @param requestId ID de la solicitud
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

    /// @notice El profesor rechaza una solicitud de uso pendiente
    /// @param requestId ID de la solicitud
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

    /// @notice Pausa el contrato (solo admin)
    function pause() external {
        if (!campusRoles.isAdmin(msg.sender)) revert NotAdmin();
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external {
        if (!campusRoles.isAdmin(msg.sender)) revert NotAdmin();
        _unpause();
    }

    // ── External view functions ─────────────────────────────────────────

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getSubjectBadge(uint256 subjectBadgeId) external view returns (SubjectBadge memory) {
        return _subjectBadges[subjectBadgeId];
    }

    /// @notice Devuelve los datos de una assignment
    /// @param assignmentId ID de la assignment
    /// @return Datos de la assignment
    function getAssignment(uint256 assignmentId) external view returns (Assignment memory) {
        return _assignments[assignmentId];
    }

    /// @notice Devuelve los datos de una categoria de premio
    /// @param prizeCategoryId ID de la categoria
    /// @return Datos de la categoria
    function getPrizeCategory(uint256 prizeCategoryId) external view returns (PrizeCategory memory) {
        return _prizeCategories[prizeCategoryId];
    }

    /// @notice Devuelve los datos de una recompensa
    /// @param rewardId ID de la recompensa
    /// @return Datos de la recompensa
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

    /// @notice Devuelve los datos de una solicitud de uso
    /// @param requestId ID de la solicitud
    /// @return Datos de la solicitud
    function getUseRequest(uint256 requestId) external view returns (UseRequest memory) {
        return _useRequests[requestId];
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getStudentUseRequests(address student) external view returns (uint256[] memory) {
        return _studentUseRequests[student];
    }

    /// @notice Calcula el token ID del recibo de canje para una recompensa dada
    /// @param rewardId ID de la recompensa
    /// @return Token ID del recibo (REWARD_TOKEN_OFFSET + rewardId)
    function getRewardTokenId(uint256 rewardId) external pure returns (uint256) {
        return REWARD_TOKEN_OFFSET + rewardId;
    }

    // ── Soulbound enforcement ───────────────────────────────────────────

    /// @dev OZ v5: _update reemplaza a _beforeTokenTransfer.
    ///      Bloquea cualquier transferencia entre direcciones externas:
    ///      las insignias son soulbound y solo pueden mintearse o quemarse.
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

    /// @dev Bloqueado por ser tokens soulbound
    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert SoulboundTransferBlocked();
    }

    /// @dev Bloqueado por ser tokens soulbound
    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert SoulboundTransferBlocked();
    }

    /// @dev Bloqueado por ser tokens soulbound
    function setApprovalForAll(address, bool) public pure override {
        revert SoulboundTransferBlocked();
    }

    /// @dev Tokens soulbound: nunca hay approvals
    function isApprovedForAll(address, address) public pure override returns (bool) {
        return false;
    }
}
