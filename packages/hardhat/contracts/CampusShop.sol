// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { CampusRoles } from "./CampusRoles.sol";
import { ShopToken } from "./ShopToken.sol";

/// @title CampusShop
/// @author Juan Pablo Fernández <juanpf04@ucm.es>
/// @author Arturo Gómez <argome04@ucm.es>
/// @notice Tienda del campus con flujo de compra y devolucion
/// @dev Productos y recibos modelados como ERC-1155; pagos con ShopToken.
contract CampusShop is ERC1155, ERC1155Supply, ReentrancyGuard, Pausable {
    // ── Type declarations ───────────────────────────────────────────────

    /// @notice Referencia al control de acceso del campus
    CampusRoles public immutable campusRoles;

    /// @notice Token ERC-20 usado para pagos y reembolsos
    ShopToken public immutable shopToken;

    // El nombre, descripcion e imagen del producto se guardan en Prisma vinculados por productId.
    // En la blockchain solo guardamos precio y stock (necesarios para la logica de compra).
    struct Product {
        uint256 price;
        uint256 stock;
        bool active;
        bool exists;
    }

    /// @notice Estados posibles de una orden
    enum OrderStatus { None, Paid, Delivered, Returned }

    /// @notice Datos de orden de compra
    struct Order {
        uint256 productId;
        address buyer;
        uint256 pricePaid;
        OrderStatus status;
        uint40 purchaseDate;
        uint40 deliveryDate;
        uint40 returnDate;
    }

    /// @notice Datos de un pedido agrupado (batch)
    struct Batch {
        address buyer;
        uint256[] orderIds;
        uint256 totalPaid;
        uint40 purchaseDate;
    }

    // ── State variables ─────────────────────────────────────────────────

    uint256 public nextProductId = 1;
    mapping(uint256 => Product) private _products;

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) private _orders;
    mapping(address => uint256[]) private _studentOrders;

    uint256 public nextBatchId = 1;
    mapping(uint256 => Batch) private _batches;
    mapping(uint256 => uint256) public orderToBatch;
    mapping(address => uint256[]) private _studentBatches;

    uint256 public constant RETURN_WINDOW = 30 days;
    /// @dev Los recibos de compra usan token IDs 1..999999 (productId).
    ///      Los recibos de devolucion usan RETURN_RECEIPT_OFFSET + orderId
    ///      para evitar colisiones sin necesidad de un contador separado.
    uint256 public constant RETURN_RECEIPT_OFFSET = 1_000_000;

    // ── Errors ──────────────────────────────────────────────────────────
    error NotAdmin();
    error NotStudent();
    error ProductNotFound(uint256 productId);
    error ProductNotActive(uint256 productId);
    error ProductOutOfStock(uint256 productId);
    error OrderNotFound(uint256 orderId);
    error InvalidOrderState(uint256 orderId, OrderStatus current);
    error NotOrderOwner(uint256 orderId);
    error ReturnWindowExpired(uint256 orderId);
    error ZeroPrice();
    error ProductAlreadyInState(uint256 productId, bool active);
    error EmptyBatch();

    // ── Events ──────────────────────────────────────────────────────────

    event ProductAdded(uint256 indexed productId, uint256 price, uint256 stock);
    event ProductUpdated(uint256 indexed productId, uint256 newPrice, uint256 newStock);
    event ProductDeactivated(uint256 indexed productId);
    event ProductReactivated(uint256 indexed productId);
    event OrderCreated(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 pricePaid);
    event OrderDelivered(uint256 indexed orderId);
    event OrderReturned(uint256 indexed orderId, address indexed buyer, uint256 refundAmount);
    event ReturnReceiptMinted(uint256 indexed orderId, address indexed buyer, uint256 returnTokenId);
    event BatchPurchase(uint256 indexed batchId, address indexed buyer, uint256 totalPaid, uint256 itemCount);

    constructor(
        address _campusRoles,
        address _shopToken,
        string memory uri_
    ) ERC1155(uri_) {
        campusRoles = CampusRoles(_campusRoles);
        shopToken = ShopToken(_shopToken);
    }

    // ── Modifiers ───────────────────────────────────────────────────────
    modifier onlyAdmin() {
        if (!campusRoles.hasRole(campusRoles.ADMIN_ROLE(), msg.sender))
            revert NotAdmin();
        _;
    }

    modifier onlyStudent() {
        if (!campusRoles.hasRole(campusRoles.STUDENT_ROLE(), msg.sender))
            revert NotStudent();
        _;
    }

    // ── Functions ───────────────────────────────────────────────────────

    // ── External functions ──────────────────────────────────────────────

    // ── Product management ──────────────────────────────────────────────

    /**
     * @dev Anade un nuevo producto al catalogo.
     */
    function addProduct(
        uint256 price,
        uint256 stock
    ) external onlyAdmin returns (uint256 productId) {
        if (price == 0) revert ZeroPrice();

        productId = nextProductId;
        unchecked { ++nextProductId; }

        _products[productId] = Product({
            price: price,
            stock: stock,
            active: true,
            exists: true
        });

        emit ProductAdded(productId, price, stock);
    }

    /**
     * @dev Actualiza precio y stock de un producto.
     */
    function updateProduct(
        uint256 productId,
        uint256 newPrice,
        uint256 newStock
    ) external onlyAdmin {
        if (!_products[productId].exists) revert ProductNotFound(productId);
        if (newPrice == 0) revert ZeroPrice();

        _products[productId].price = newPrice;
        _products[productId].stock = newStock;

        emit ProductUpdated(productId, newPrice, newStock);
    }

    /**
     * @dev Desactiva un producto.
     */
    function deactivateProduct(uint256 productId) external onlyAdmin {
        if (!_products[productId].exists) revert ProductNotFound(productId);
        if (!_products[productId].active) revert ProductAlreadyInState(productId, false);

        _products[productId].active = false;
        emit ProductDeactivated(productId);
    }

    /**
     * @dev Reactiva un producto previamente desactivado.
     */
    function reactivateProduct(uint256 productId) external onlyAdmin {
        if (!_products[productId].exists) revert ProductNotFound(productId);
        if (_products[productId].active) revert ProductAlreadyInState(productId, true);

        _products[productId].active = true;
        emit ProductReactivated(productId);
    }

    // ── Purchase flow ───────────────────────────────────────────────────

    /**
     * @dev Compra un producto. Paga ShopTokens (escrow), recibe NFT recibo.
     */
    function purchase(uint256 productId) external onlyStudent whenNotPaused nonReentrant returns (uint256 orderId) {
        Product storage product = _products[productId];
        if (!product.exists) revert ProductNotFound(productId);
        if (!product.active) revert ProductNotActive(productId);
        if (product.stock == 0) revert ProductOutOfStock(productId);

        uint256 price = product.price;

        // --- Effects ---
        unchecked { product.stock -= 1; }

        orderId = nextOrderId;
        unchecked { ++nextOrderId; }

        _orders[orderId] = Order({
            productId: productId,
            buyer: msg.sender,
            pricePaid: price,
            status: OrderStatus.Paid,
            purchaseDate: uint40(block.timestamp),
            deliveryDate: 0,
            returnDate: 0
        });

        _studentOrders[msg.sender].push(orderId);

        // --- Interactions ---
        // 1. Transferir ShopTokens al contrato (escrow)
        shopToken.transferFrom(msg.sender, address(this), price);

        // 2. Mintear NFT recibo al estudiante
        _mint(msg.sender, productId, 1, "");

        emit OrderCreated(orderId, msg.sender, productId, price);
    }

    /**
     * @dev Compra múltiples productos en una sola transacción atómica.
     *      Si algún producto no tiene stock o no está activo, revierte toda la compra.
     *      Crea un Batch que agrupa todos los orderIds individuales.
     * @param productIds Array de IDs de producto (puede contener duplicados para múltiples unidades).
     * @return batchId El ID del batch creado.
     */
    function purchaseBatch(
        uint256[] calldata productIds
    ) external onlyStudent whenNotPaused nonReentrant returns (uint256 batchId) {
        uint256 len = productIds.length;
        if (len == 0) revert EmptyBatch();

        // 1. Calcular precio total y validar todos los productos
        uint256 totalPrice = 0;
        for (uint256 i = 0; i < len; ) {
            Product storage product = _products[productIds[i]];
            if (!product.exists) revert ProductNotFound(productIds[i]);
            if (!product.active) revert ProductNotActive(productIds[i]);
            if (product.stock == 0) revert ProductOutOfStock(productIds[i]);
            totalPrice += product.price;
            unchecked { ++i; }
        }

        // 2. Una sola transferencia de ShopTokens por el total
        shopToken.transferFrom(msg.sender, address(this), totalPrice);

        // 3. Crear batch
        batchId = nextBatchId;
        unchecked { ++nextBatchId; }

        uint256[] memory orderIds = new uint256[](len);

        // 4. Crear orders individuales + decrementar stock + mintear NFTs
        for (uint256 i = 0; i < len; ) {
            uint256 pid = productIds[i];
            Product storage product = _products[pid];
            uint256 price = product.price;

            unchecked { product.stock -= 1; }

            uint256 orderId = nextOrderId;
            unchecked { ++nextOrderId; }

            _orders[orderId] = Order({
                productId: pid,
                buyer: msg.sender,
                pricePaid: price,
                status: OrderStatus.Paid,
                purchaseDate: uint40(block.timestamp),
                deliveryDate: 0,
                returnDate: 0
            });

            _studentOrders[msg.sender].push(orderId);
            orderIds[i] = orderId;
            orderToBatch[orderId] = batchId;

            // Mintear NFT recibo
            _mint(msg.sender, pid, 1, "");

            emit OrderCreated(orderId, msg.sender, pid, price);

            unchecked { ++i; }
        }

        // 5. Guardar batch
        _batches[batchId] = Batch({
            buyer: msg.sender,
            orderIds: orderIds,
            totalPaid: totalPrice,
            purchaseDate: uint40(block.timestamp)
        });

        _studentBatches[msg.sender].push(batchId);

        emit BatchPurchase(batchId, msg.sender, totalPrice, len);
    }

    // ── Order management ────────────────────────────────────────────────

    /**
     * @dev Marca un pedido como entregado.
     */
    function markDelivered(uint256 orderId) external onlyAdmin {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Paid)
            revert InvalidOrderState(orderId, order.status);

        order.status = OrderStatus.Delivered;
        order.deliveryDate = uint40(block.timestamp);

        emit OrderDelivered(orderId);
    }

    /**
     * @dev Procesa devolucion/cancelacion. Quema NFT, reembolsa tokens, restaura stock.
     *      Acepta pedidos Paid (cancelacion) o Delivered (devolucion).
     */
    function processReturn(uint256 orderId) external onlyAdmin whenNotPaused nonReentrant {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Paid && order.status != OrderStatus.Delivered)
            revert InvalidOrderState(orderId, order.status);

        uint256 productId = order.productId;
        address buyer = order.buyer;
        uint256 refund = order.pricePaid;

        // --- Effects ---
        order.status = OrderStatus.Returned;
        order.returnDate = uint40(block.timestamp);
        _products[productId].stock += 1;

        uint256 returnTokenId = RETURN_RECEIPT_OFFSET + orderId;

        // --- Interactions ---
        // 1. Quemar NFT recibo de compra del comprador
        _burn(buyer, productId, 1);

        // 2. Mintear NFT recibo de devolucion
        _mint(buyer, returnTokenId, 1, "");

        // 3. Reembolsar ShopTokens
        shopToken.transfer(buyer, refund);

        emit ReturnReceiptMinted(orderId, buyer, returnTokenId);
        emit OrderReturned(orderId, buyer, refund);
    }

    /**
     * @dev El propio estudiante solicita la devolucion dentro del periodo permitido.
     *      No requiere intervencion del admin. Quema el NFT recibo y reembolsa
     *      automaticamente. Solo funciona si el pedido esta en estado Delivered
     *      y no han pasado mas de RETURN_WINDOW (30 dias) desde la entrega.
     */
    function requestReturn(uint256 orderId) external onlyStudent whenNotPaused nonReentrant {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Delivered)
            revert InvalidOrderState(orderId, order.status);
        if (msg.sender != order.buyer) revert NotOrderOwner(orderId);
        if (block.timestamp > uint256(order.deliveryDate) + RETURN_WINDOW)
            revert ReturnWindowExpired(orderId);

        uint256 productId = order.productId;
        address buyer = order.buyer;
        uint256 refund = order.pricePaid;

        // --- Effects ---
        order.status = OrderStatus.Returned;
        order.returnDate = uint40(block.timestamp);
        _products[productId].stock += 1;

        uint256 returnTokenId = RETURN_RECEIPT_OFFSET + orderId;

        // --- Interactions ---
        // 1. Quemar NFT recibo de compra
        _burn(buyer, productId, 1);

        // 2. Mintear NFT recibo de devolucion
        _mint(buyer, returnTokenId, 1, "");

        // 3. Reembolsar ShopTokens
        shopToken.transfer(buyer, refund);

        emit ReturnReceiptMinted(orderId, buyer, returnTokenId);
        emit OrderReturned(orderId, buyer, refund);
    }

    // ── Pausable ─────────────────────────────────────────────────────────

    /// @notice Pausa el contrato (solo admin)
    function pause() external onlyAdmin {
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ── External view functions ─────────────────────────────────────────

    function getProduct(uint256 productId) external view returns (
        uint256 price,
        uint256 stock,
        bool active,
        bool exists_
    ) {
        Product storage p = _products[productId];
        return (p.price, p.stock, p.active, p.exists);
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }

    function getStudentOrders(address student) external view returns (uint256[] memory) {
        return _studentOrders[student];
    }

    function getBatch(uint256 batchId) external view returns (
        address buyer,
        uint256[] memory orderIds,
        uint256 totalPaid,
        uint40 purchaseDate
    ) {
        Batch storage b = _batches[batchId];
        return (b.buyer, b.orderIds, b.totalPaid, b.purchaseDate);
    }

    function getStudentBatches(address student) external view returns (uint256[] memory) {
        return _studentBatches[student];
    }

    /// @dev Calcula el token ID del recibo de devolucion para un orderId dado.
    ///      Util para que el frontend sepa qué token ID consultar.
    function getReturnReceiptTokenId(uint256 orderId) external pure returns (uint256) {
        return RETURN_RECEIPT_OFFSET + orderId;
    }

    // ── Internal functions ──────────────────────────────────────────────

    /**
     * @dev OZ v5: _update reemplaza a _beforeTokenTransfer (firma sin operator ni data).
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
