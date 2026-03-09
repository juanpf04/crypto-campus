// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CampusAccessControl.sol";
import "./ShopToken.sol";

/**
 * @title CampusShop
 * @dev Tienda del campus. Productos como ERC-1155 (recibos/prueba de compra).
 *      Pagos con ShopToken (ERC-20) en escrow para permitir reembolsos.
 */
contract CampusShop is ERC1155, ERC1155Supply, ReentrancyGuard {

    CampusAccessControl public immutable accessControl;
    ShopToken public immutable shopToken;

    // --- Structs ---
    // El nombre, descripcion e imagen del producto se guardan en Prisma vinculados por productId.
    // En la blockchain solo guardamos precio y stock (necesarios para la logica de compra).
    struct Product {
        uint256 price;
        uint256 stock;
        bool active;
        bool exists;
    }

    enum OrderStatus { None, Paid, Delivered, Returned }

    struct Order {
        uint256 productId;
        address buyer;
        uint256 pricePaid;
        OrderStatus status;
        uint40 purchaseDate;
        uint40 deliveryDate;
        uint40 returnDate;
    }

    // --- State ---
    uint256 public nextProductId = 1;
    mapping(uint256 => Product) private _products;

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) private _orders;
    mapping(address => uint256[]) private _studentOrders;

    // --- Constants ---
    uint256 public constant RETURN_WINDOW = 30 days;
    /// @dev Los recibos de compra usan token IDs 1..999999 (productId).
    ///      Los recibos de devolucion usan RETURN_RECEIPT_OFFSET + orderId
    ///      para evitar colisiones sin necesidad de un contador separado.
    uint256 public constant RETURN_RECEIPT_OFFSET = 1_000_000;

    // --- Custom Errors ---
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

    // --- Events ---
    event ProductAdded(uint256 indexed productId, uint256 price, uint256 stock);
    event ProductUpdated(uint256 indexed productId, uint256 newPrice, uint256 newStock);
    event ProductDeactivated(uint256 indexed productId);
    event ProductReactivated(uint256 indexed productId);
    event OrderCreated(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 pricePaid);
    event OrderDelivered(uint256 indexed orderId);
    event OrderReturned(uint256 indexed orderId, address indexed buyer, uint256 refundAmount);
    event ReturnReceiptMinted(uint256 indexed orderId, address indexed buyer, uint256 returnTokenId);

    constructor(
        address _accessControl,
        address _shopToken,
        string memory uri_
    ) ERC1155(uri_) {
        accessControl = CampusAccessControl(_accessControl);
        shopToken = ShopToken(_shopToken);
    }

    // --- Modifiers ---
    modifier onlyAdmin() {
        if (!accessControl.hasRole(accessControl.DEFAULT_ADMIN_ROLE(), msg.sender))
            revert NotAdmin();
        _;
    }

    modifier onlyStudent() {
        if (!accessControl.hasRole(accessControl.STUDENT_ROLE(), msg.sender))
            revert NotStudent();
        _;
    }

    // =========================================================================
    // PRODUCT MANAGEMENT (Admin)
    // =========================================================================

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

    // =========================================================================
    // PURCHASE FLOW (Student)
    // =========================================================================

    /**
     * @dev Compra un producto. Paga ShopTokens (escrow), recibe NFT recibo.
     */
    function purchase(uint256 productId) external onlyStudent nonReentrant returns (uint256 orderId) {
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

    // =========================================================================
    // ORDER MANAGEMENT (Admin)
    // =========================================================================

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
    function processReturn(uint256 orderId) external onlyAdmin nonReentrant {
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
    function requestReturn(uint256 orderId) external onlyStudent nonReentrant {
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

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

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

    /// @dev Calcula el token ID del recibo de devolucion para un orderId dado.
    ///      Util para que el frontend sepa qué token ID consultar.
    function getReturnReceiptTokenId(uint256 orderId) external pure returns (uint256) {
        return RETURN_RECEIPT_OFFSET + orderId;
    }

    // =========================================================================
    // ERC-1155 OVERRIDES
    // =========================================================================

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
