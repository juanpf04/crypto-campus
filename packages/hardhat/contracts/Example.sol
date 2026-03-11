// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ============================================================================
// EJEMPLO DE CONTRATO - GUÍA DE ESTILO SOLIDITY
// ============================================================================
//
// Este contrato sirve como referencia de estilo para todos los contratos del
// proyecto CryptoCampus. Sigue las convenciones de la Solidity Style Guide.
//
// Orden del archivo:
//   1. Pragma
//   2. Imports
//   3. Events (a nivel de archivo, si aplica)
//   4. Errors (a nivel de archivo, si aplica)
//   5. Interfaces
//   6. Libraries
//   7. Contracts
//
// Dentro de cada contrato:
//   1. Type declarations (enums, structs)
//   2. State variables
//   3. Events
//   4. Errors
//   5. Modifiers
//   6. Functions
//
// Orden de funciones:
//   1. constructor
//   2. receive (si existe)
//   3. fallback (si existe)
//   4. external
//   5. public
//   6. internal
//   7. private
//   Dentro de cada grupo, view y pure van al final.
//
// Orden de modificadores en funciones:
//   1. Visibility (external, public, internal, private)
//   2. Mutability (view, pure, payable)
//   3. Virtual
//   4. Override
//   5. Custom modifiers
//
// Natspec:
///  @title - breve descripción del contrato
///  @author - autor del contrato
///  @notice - descripción para usuarios finales
///  @dev - detalles técnicos para desarrolladores
///  @param nombre - descripción de cada parámetro de función
///  @return nombre- descripción de cada valor de retorno
///  @inheritdoc - referencia a documentación heredada
///  @custom:loquequieras - etiquetas personalizadas 
//
// ============================================================================

import "@openzeppelin/contracts/access/Ownable.sol";


/// @title Example
/// @author CryptoCampus Team
/// @notice Contrato de ejemplo que demuestra las convenciones de estilo
/// @dev Usar como referencia al crear nuevos contratos en el proyecto
contract Example is Ownable {
    // ── Type declarations ───────────────────────────────────────────────

    /// @notice Estados posibles de un item
    enum ItemStatus {
        Active,
        Paused,
        Retired
    }

    /// @notice Datos de un item registrado
    struct ItemData {
        address creator;
        uint256 value;
        string name;
        ItemStatus status;
    }

    // ── State variables ─────────────────────────────────────────────────

    /// @notice Versión del contrato
    uint256 public constant CONTRACT_VERSION = 1;

    /// @notice Límite máximo de items
    uint256 public constant MAX_ITEMS = 100;

    /// @notice Contador total de items
    uint256 public totalItems;

    /// @notice Precio base para crear un item
    uint256 public basePrice;

    /// @dev Mapping de ID a datos del item
    mapping(uint256 => ItemData) private _items;

    /// @dev Mapping de dirección a sus IDs de items
    mapping(address => uint256[]) private _userItems;

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Se emite al crear un item
    /// @param itemId ID del nuevo item
    /// @param creator Dirección del creador
    /// @param name Nombre del item
    event ItemCreated(
        uint256 indexed itemId,
        address indexed creator,
        string name
    );

    /// @notice Se emite al cambiar el estado de un item
    /// @param itemId ID del item
    /// @param newStatus Nuevo estado
    event ItemStatusChanged(uint256 indexed itemId, ItemStatus newStatus);

    /// @notice Se emite al actualizar el precio base
    /// @param oldPrice Precio anterior
    /// @param newPrice Precio nuevo
    event BasePriceUpdated(uint256 oldPrice, uint256 newPrice);

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice El item solicitado no existe
    error ItemNotFound(uint256 itemId);

    /// @notice Se alcanzó el límite máximo de items
    error MaxItemsReached();

    /// @notice Fondos insuficientes para la operación
    error InsufficientFunds(uint256 required, uint256 provided);

    /// @notice Solo el creador puede realizar esta acción
    error OnlyCreator(address caller, address creator);

    // ── Modifiers ───────────────────────────────────────────────────────

    /// @notice Verifica que el item exista
    /// @param itemId ID del item a verificar
    modifier onlyExistingItem(uint256 itemId) {
        if (itemId >= totalItems) {
            revert ItemNotFound(itemId);
        }
        _;
    }

    /// @notice Verifica que el caller sea el creador del item
    /// @param itemId ID del item
    modifier onlyItemCreator(uint256 itemId) {
        ItemData storage item = _items[itemId];
        if (msg.sender != item.creator) {
            revert OnlyCreator(msg.sender, item.creator);
        }
        _;
    }

    // ── Functions ────────────────────────────────────────────────────────

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Inicializa el contrato con un precio base
    /// @param initialPrice Precio base inicial para crear items
    constructor(uint256 initialPrice) Ownable(msg.sender) {
        basePrice = initialPrice;
    }

    // ── Receive & Fallback ──────────────────────────────────────────────

    /// @notice Permite recibir ETH directamente
    receive() external payable {
        // Acepta ETH
    }

    /// @notice Fallback para llamadas no reconocidas
    fallback() external payable {
        // Acepta ETH
    }

    // ── External functions ──────────────────────────────────────────────

    /// @notice Crea un nuevo item pagando el precio base
    /// @param name Nombre del item
    /// @return itemId ID del item creado
    function createItem(string calldata name) external payable returns (uint256 itemId) {
        if (totalItems >= MAX_ITEMS) {
            revert MaxItemsReached();
        }
        if (msg.value < basePrice) {
            revert InsufficientFunds(basePrice, msg.value);
        }

        itemId = totalItems;
        _items[itemId] = ItemData({
            creator: msg.sender,
            value: msg.value,
            name: name,
            status: ItemStatus.Active
        });
        _userItems[msg.sender].push(itemId);
        totalItems++;

        emit ItemCreated(itemId, msg.sender, name);
    }

    /// @notice Cambia el estado de un item (solo su creador)
    /// @param itemId ID del item
    /// @param newStatus Nuevo estado a asignar
    function changeItemStatus(
        uint256 itemId,
        ItemStatus newStatus
    )
        external
        onlyExistingItem(itemId)
        onlyItemCreator(itemId)
    {
        _items[itemId].status = newStatus;
        emit ItemStatusChanged(itemId, newStatus);
    }

    /// @notice Retira los fondos del contrato (solo owner)
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) {
            revert InsufficientFunds(1, 0);
        }

        (bool success,) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    // ── External view functions ─────────────────────────────────────────

    /// @notice Obtiene los datos de un item
    /// @param itemId ID del item
    /// @return creator Dirección del creador
    /// @return value Valor depositado
    /// @return name Nombre del item
    /// @return status Estado actual
    function getItem(uint256 itemId)
        external
        view
        onlyExistingItem(itemId)
        returns (
            address creator,
            uint256 value,
            string memory name,
            ItemStatus status
        )
    {
        ItemData storage item = _items[itemId];
        return (item.creator, item.value, item.name, item.status);
    }

    /// @notice Obtiene los IDs de items de un usuario
    /// @param user Dirección del usuario
    /// @return Array de IDs de items
    function getUserItems(address user) external view returns (uint256[] memory) {
        return _userItems[user];
    }

    // ── Public functions ────────────────────────────────────────────────

    /// @notice Actualiza el precio base (solo owner)
    /// @param newPrice Nuevo precio base
    function setBasePrice(uint256 newPrice) public onlyOwner {
        uint256 oldPrice = basePrice;
        basePrice = newPrice;
        emit BasePriceUpdated(oldPrice, newPrice);
    }

    // ── Public view functions ───────────────────────────────────────────

    /// @notice Verifica si un item está activo
    /// @param itemId ID del item
    /// @return True si el item está activo
    function isItemActive(uint256 itemId) public view onlyExistingItem(itemId) returns (bool) {
        return _items[itemId].status == ItemStatus.Active;
    }

    // ── Internal functions ──────────────────────────────────────────────

    /// @dev Valida que un nombre no esté vacío
    /// @param name Nombre a validar
    /// @return True si el nombre es válido
    function _validateName(string calldata name) internal pure returns (bool) {
        return bytes(name).length > 0;
    }

    // ── Private functions ───────────────────────────────────────────────

    /// @dev Calcula el precio con descuento para un usuario
    /// @param user Dirección del usuario
    /// @return Precio final calculado
    function _calculatePrice(address user) private view returns (uint256) {
        uint256 itemCount = _userItems[user].length;
        if (itemCount > 10) {
            return basePrice * 80 / 100;
        }
        return basePrice;
    }
}
