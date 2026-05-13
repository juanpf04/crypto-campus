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

    /// @notice Datos minimos de un producto en cadena
    /// @dev El nombre, descripcion e imagen del producto se guardan en Prisma vinculados por productId.
    ///      En la blockchain solo guardamos precio y stock (necesarios para la logica de compra).
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

    /// @notice Contador autoincremental de productos
    uint256 public nextProductId = 1;
    /// @dev Catalogo de productos por ID
    mapping(uint256 => Product) private _products;

    /// @notice Contador autoincremental de ordenes
    uint256 public nextOrderId = 1;
    /// @dev Registro de ordenes por ID
    mapping(uint256 => Order) private _orders;
    /// @dev Historico de ordenes por comprador
    mapping(address => uint256[]) private _studentOrders;

    /// @notice Contador autoincremental de batches (compras agrupadas)
    uint256 public nextBatchId = 1;
    /// @dev Registro de batches por ID
    mapping(uint256 => Batch) private _batches;
    /// @notice Relacion order -> batch al que pertenece (0 si no pertenece a un batch)
    mapping(uint256 => uint256) public orderToBatch;
    /// @dev Historico de batches por comprador
    mapping(address => uint256[]) private _studentBatches;

    /// @notice Ventana temporal para solicitar devolucion tras la entrega
    uint256 public constant RETURN_WINDOW = 30 days;
    /// @notice Offset aplicado al orderId para calcular el token ID del recibo de devolucion
    /// @dev Los recibos de compra usan token IDs 1..999999 (productId).
    ///      Los recibos de devolucion usan RETURN_RECEIPT_OFFSET + orderId
    ///      para evitar colisiones sin necesidad de un contador separado.
    uint256 public constant RETURN_RECEIPT_OFFSET = 1_000_000;

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Se emite al anadir un nuevo producto al catalogo
    /// @param productId ID del producto creado
    /// @param price Precio en ShopTokens
    /// @param stock Stock inicial
    event ProductAdded(uint256 indexed productId, uint256 price, uint256 stock);

    /// @notice Se emite al actualizar precio y stock de un producto
    /// @param productId ID del producto
    /// @param newPrice Nuevo precio
    /// @param newStock Nuevo stock
    event ProductUpdated(uint256 indexed productId, uint256 newPrice, uint256 newStock);

    /// @notice Se emite al desactivar un producto
    /// @param productId ID del producto desactivado
    event ProductDeactivated(uint256 indexed productId);

    /// @notice Se emite al reactivar un producto
    /// @param productId ID del producto reactivado
    event ProductReactivated(uint256 indexed productId);

    /// @notice Se emite al crear una orden de compra
    /// @param orderId ID de la orden
    /// @param buyer Direccion del comprador
    /// @param productId ID del producto comprado
    /// @param pricePaid Precio pagado en ShopTokens
    event OrderCreated(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 pricePaid);

    /// @notice Se emite al marcar una orden como entregada
    /// @param orderId ID de la orden entregada
    event OrderDelivered(uint256 indexed orderId);

    /// @notice Se emite al procesar la devolucion de una orden
    /// @param orderId ID de la orden devuelta
    /// @param buyer Direccion del comprador
    /// @param refundAmount Tokens reembolsados
    event OrderReturned(uint256 indexed orderId, address indexed buyer, uint256 refundAmount);

    /// @notice Se emite al mintear el NFT recibo de devolucion
    /// @param orderId ID de la orden devuelta
    /// @param buyer Direccion del comprador
    /// @param returnTokenId Token ID del recibo de devolucion minteado
    event ReturnReceiptMinted(uint256 indexed orderId, address indexed buyer, uint256 returnTokenId);

    /// @notice Se emite al crear un batch de compras
    /// @param batchId ID del batch
    /// @param buyer Direccion del comprador
    /// @param totalPaid Tokens totales pagados
    /// @param itemCount Numero de unidades en el batch
    event BatchPurchase(uint256 indexed batchId, address indexed buyer, uint256 totalPaid, uint256 itemCount);

    // ── Errors ──────────────────────────────────────────────────────────

    /// @notice Caller sin rol admin
    error NotAdmin();
    /// @notice Caller sin rol student
    error NotStudent();
    /// @notice El producto no existe en el catalogo
    /// @param productId ID del producto solicitado
    error ProductNotFound(uint256 productId);
    /// @notice El producto esta desactivado
    /// @param productId ID del producto
    error ProductNotActive(uint256 productId);
    /// @notice El producto no tiene stock disponible
    /// @param productId ID del producto
    error ProductOutOfStock(uint256 productId);
    /// @notice La orden no existe
    /// @param orderId ID de la orden solicitada
    error OrderNotFound(uint256 orderId);
    /// @notice La orden no esta en un estado valido para la operacion
    /// @param orderId ID de la orden
    /// @param current Estado actual de la orden
    error InvalidOrderState(uint256 orderId, OrderStatus current);
    /// @notice Solo el comprador puede operar sobre la orden
    /// @param orderId ID de la orden
    error NotOrderOwner(uint256 orderId);
    /// @notice Ha expirado la ventana de devolucion del pedido
    /// @param orderId ID de la orden
    error ReturnWindowExpired(uint256 orderId);
    /// @notice El precio no puede ser cero
    error ZeroPrice();
    /// @notice El producto ya esta en el estado destino
    /// @param productId ID del producto
    /// @param active Estado actual
    error ProductAlreadyInState(uint256 productId, bool active);
    /// @notice El batch de compra no contiene productos
    error EmptyBatch();

    // ── Modifiers ───────────────────────────────────────────────────────

    /// @notice Restringe la ejecucion a admins del sistema
    modifier onlyAdmin() {
        if (!campusRoles.isAdmin(msg.sender))
            revert NotAdmin();
        _;
    }

    /// @notice Restringe la ejecucion a estudiantes
    modifier onlyStudent() {
        if (!campusRoles.isStudent(msg.sender))
            revert NotStudent();
        _;
    }

    // ── Functions ───────────────────────────────────────────────────────

    // ── Constructor ─────────────────────────────────────────────────────

    /// @notice Inicializa la tienda con sus dependencias
    /// @param _campusRoles Direccion del contrato CampusRoles
    /// @param _shopToken Direccion del contrato ShopToken
    /// @param uri_ URI base para los metadatos ERC-1155
    constructor(
        address _campusRoles,
        address _shopToken,
        string memory uri_
    ) ERC1155(uri_) {
        campusRoles = CampusRoles(_campusRoles);
        shopToken = ShopToken(_shopToken);
    }

    // ── External functions ──────────────────────────────────────────────

    // ── Product management ──────────────────────────────────────────────

    /// @notice Anade un nuevo producto al catalogo
    /// @param price Precio en ShopTokens
    /// @param stock Stock inicial
    /// @return productId ID asignado al nuevo producto
    function addProduct(
        uint256 price,
        uint256 stock
    ) external onlyAdmin whenNotPaused returns (uint256 productId) {
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

    /// @notice Actualiza precio y stock de un producto
    /// @param productId ID del producto a actualizar
    /// @param newPrice Nuevo precio
    /// @param newStock Nuevo stock
    function updateProduct(
        uint256 productId,
        uint256 newPrice,
        uint256 newStock
    ) external onlyAdmin whenNotPaused {
        if (!_products[productId].exists) revert ProductNotFound(productId);
        if (newPrice == 0) revert ZeroPrice();

        _products[productId].price = newPrice;
        _products[productId].stock = newStock;

        emit ProductUpdated(productId, newPrice, newStock);
    }

    /// @notice Desactiva un producto del catalogo
    /// @param productId ID del producto
    function deactivateProduct(uint256 productId) external onlyAdmin whenNotPaused {
        if (!_products[productId].exists) revert ProductNotFound(productId);
        if (!_products[productId].active) revert ProductAlreadyInState(productId, false);

        _products[productId].active = false;
        emit ProductDeactivated(productId);
    }

    /// @notice Reactiva un producto previamente desactivado
    /// @param productId ID del producto
    function reactivateProduct(uint256 productId) external onlyAdmin whenNotPaused {
        if (!_products[productId].exists) revert ProductNotFound(productId);
        if (_products[productId].active) revert ProductAlreadyInState(productId, true);

        _products[productId].active = true;
        emit ProductReactivated(productId);
    }

    // ── Purchase flow ───────────────────────────────────────────────────

    /// @notice Compra un producto individual
    /// @dev Paga ShopTokens al contrato (escrow) y mintea NFT recibo al comprador
    /// @param productId ID del producto a comprar
    /// @return orderId ID de la orden creada
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

    /// @notice Compra multiples productos en una sola transaccion atomica
    /// @dev Si algun producto no tiene stock o no esta activo, revierte toda la compra.
    ///      Crea un Batch que agrupa todos los orderIds individuales.
    /// @param productIds Array de IDs de producto (puede contener duplicados para multiples unidades)
    /// @return batchId El ID del batch creado
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

    /// @notice Marca un pedido como entregado
    /// @param orderId ID de la orden
    function markDelivered(uint256 orderId) external onlyAdmin whenNotPaused {
        Order storage order = _orders[orderId];
        if (order.status == OrderStatus.None) revert OrderNotFound(orderId);
        if (order.status != OrderStatus.Paid)
            revert InvalidOrderState(orderId, order.status);

        order.status = OrderStatus.Delivered;
        order.deliveryDate = uint40(block.timestamp);

        emit OrderDelivered(orderId);
    }

    /// @notice Procesa devolucion/cancelacion de un pedido (admin)
    /// @dev Quema NFT, reembolsa tokens y restaura stock.
    ///      Acepta pedidos Paid (cancelacion) o Delivered (devolucion).
    /// @param orderId ID de la orden
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

    /// @notice El propio estudiante solicita la devolucion dentro del periodo permitido
    /// @dev No requiere intervencion del admin. Quema el NFT recibo y reembolsa
    ///      automaticamente. Solo funciona si el pedido esta en estado Delivered
    ///      y no han pasado mas de RETURN_WINDOW (30 dias) desde la entrega.
    /// @param orderId ID de la orden a devolver
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

    /// @notice Pausa el contrato (solo admin)
    function pause() external onlyAdmin {
        _pause();
    }

    /// @notice Reanuda el contrato (solo admin)
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ── External view functions ─────────────────────────────────────────

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getProduct(uint256 productId) external view returns (
        uint256 price,
        uint256 stock,
        bool active,
        bool exists_
    ) {
        Product storage p = _products[productId];
        return (p.price, p.stock, p.active, p.exists);
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getStudentOrders(address student) external view returns (uint256[] memory) {
        return _studentOrders[student];
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getBatch(uint256 batchId) external view returns (
        address buyer,
        uint256[] memory orderIds,
        uint256 totalPaid,
        uint40 purchaseDate
    ) {
        Batch storage b = _batches[batchId];
        return (b.buyer, b.orderIds, b.totalPaid, b.purchaseDate);
    }

    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getStudentBatches(address student) external view returns (uint256[] memory) {
        return _studentBatches[student];
    }

    /// @dev Calcula el token ID del recibo de devolucion para un orderId dado.
    ///      Util para que el frontend sepa qué token ID consultar.
    /// @dev No las usamos porque obtenemos la informacion de prisma junto al metadata para obtener mas datos y ahorrar en coste, eliminar la funcion no supondria un coste apreciable y si en un futuro queremos que las consultas sean on-chain la necesitariamos
    function getReturnReceiptTokenId(uint256 orderId) external pure returns (uint256) {
        return RETURN_RECEIPT_OFFSET + orderId;
    }

    // ── Internal functions ──────────────────────────────────────────────

    /// @dev OZ v5: _update reemplaza a _beforeTokenTransfer (firma sin operator ni data)
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
