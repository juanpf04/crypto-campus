/**
 * shop.ts — Server Actions para el módulo de tienda del campus.
 *
 * Este módulo gestiona todas las operaciones relacionadas con la tienda:
 * - Catálogo de productos (listado, detalle, gestión por admin).
 * - Balance de ShopTokens (lectura on-chain).
 * - Compras: el estudiante firma la tx desde su wallet custodial.
 * - Pedidos: historial, detalle, marcar entregado, devoluciones.
 * - Minteo de tokens por parte del admin.
 *
 * Patrón de transacciones:
 * - Operaciones de ADMIN (addProduct, markDelivered, processReturn, mint):
 *   firmadas por adminWalletClient (Account[0] de Hardhat).
 * - Operaciones de ESTUDIANTE (purchase, requestReturn):
 *   firmadas por la wallet custodial del estudiante (descifrada de la BD).
 *   Esto es necesario porque los modifiers onlyStudent verifican msg.sender.
 */

"use server";

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionData } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { adminWalletClient, publicClient } from "@/lib/viem";
import {
	CONTRACT_ADDRESSES,
	CAMPUS_SHOP_ABI,
	SHOP_TOKEN_ABI,
} from "@/lib/contracts";

// ── Tipos ────────────────────────────────────────────────────────────────

type Role = "STUDENT" | "PROFESSOR" | "LIBRARIAN" | "ADMIN";

// ── Helpers internos ─────────────────────────────────────────────────────

/**
 * Obtiene la sesión del usuario actual desde la cookie cifrada.
 */
async function getSession() {
	return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Verifica que el usuario tiene sesión activa y rol permitido.
 * @throws Error si no autenticado o sin permisos.
 */
function ensureRole(session: SessionData, allowed: Role[]) {
	if (!session.userId || !session.role || !allowed.includes(session.role as Role)) {
		throw new Error("No autorizado");
	}
}

/**
 * Valida que un valor sea un entero positivo (> 0).
 */
function ensurePositiveInt(value: number, fieldName: string): number {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${fieldName} debe ser un entero positivo`);
	}
	return value;
}

/**
 * Valida que un valor sea un entero no negativo (>= 0).
 */
function ensureNonNegativeInt(value: number, fieldName: string): number {
	if (!Number.isInteger(value) || value < 0) {
		throw new Error(`${fieldName} debe ser un entero no negativo`);
	}
	return value;
}

/**
 * Normaliza y valida que un string no esté vacío después de trim.
 */
function cleanString(value: string, fieldName: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error(`${fieldName} es obligatorio`);
	}
	return normalized;
}

/**
 * Obtiene la dirección Ethereum de un usuario por su ID en la BD.
 */
async function getUserAddressById(userId: string): Promise<string> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { address: true },
	});
	if (!user) throw new Error("Usuario no encontrado");
	return user.address;
}

/**
 * Crea un walletClient temporal para que un usuario firme transacciones
 * desde su propia wallet custodial (necesario para purchase/requestReturn
 * donde el contrato verifica msg.sender).
 */
async function getUserWalletClient(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { address: true, encryptedKey: true },
	});
	if (!user) throw new Error("Usuario no encontrado");

	const privateKey = decrypt(user.encryptedKey) as `0x${string}`;
	const account = privateKeyToAccount(privateKey);

	const walletClient = createWalletClient({
		account,
		chain: hardhat,
		transport: http(),
	});

	return { walletClient, address: user.address };
}

/**
 * Lee el balance de ShopTokens de una dirección on-chain.
 */
async function readShopBalance(address: string): Promise<bigint> {
	try {
		return await publicClient.readContract({
			address: CONTRACT_ADDRESSES.shopToken as `0x${string}`,
			abi: SHOP_TOKEN_ABI,
			functionName: "balanceOf",
			args: [address],
		}) as bigint;
	} catch (error) {
		throw new Error(`Error al leer balance: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Productos: Lectura ───────────────────────────────────────────────────

/**
 * Lista los productos activos del catálogo.
 * Acceso: cualquier usuario autenticado.
 * @param category Filtro opcional por categoría.
 */
export async function listActiveProducts(category?: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		const where: Record<string, unknown> = { active: true };
		if (category) where.category = category;

		return await prisma.product.findMany({
			where,
			orderBy: [{ category: "asc" }, { name: "asc" }],
		});
	} catch (error) {
		throw new Error(`Error al listar productos: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista TODOS los productos (activos e inactivos) para gestión del admin.
 * Acceso: solo admin.
 */
export async function listAllProducts() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		return await prisma.product.findMany({
			orderBy: [{ category: "asc" }, { name: "asc" }],
		});
	} catch (error) {
		throw new Error(`Error al listar productos: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene el detalle de un producto por su ID de Prisma.
 * Acceso: cualquier usuario autenticado.
 */
export async function getProduct(productPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		const product = await prisma.product.findUnique({
			where: { id: productPrismaId },
		});
		if (!product) throw new Error("Producto no encontrado");
		return product;
	} catch (error) {
		if (error instanceof Error && error.message === "Producto no encontrado") throw error;
		throw new Error(`Error al obtener producto: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene las categorías únicas de los productos activos.
 * Útil para el filtro de categorías en el catálogo.
 */
export async function getProductCategories() {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		const categories = await prisma.product.findMany({
			where: { active: true, category: { not: null } },
			select: { category: true },
			distinct: ["category"],
			orderBy: { category: "asc" },
		});
		return categories.map((c) => c.category).filter(Boolean) as string[];
	} catch (error) {
		throw new Error(`Error al obtener categorías: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Productos: Gestión (admin) ───────────────────────────────────────────

/**
 * Añade un nuevo producto al catálogo (on-chain + Prisma).
 * Acceso: solo admin.
 *
 * Flujo:
 * 1. Llama a CampusShop.addProduct(price, stock) → obtiene productId on-chain
 * 2. Crea el registro en Prisma con los metadatos
 */
export async function addProduct(input: {
	name: string;
	description?: string;
	price: number;
	stock: number;
	category?: string;
	imageUrl?: string;
}) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const name = cleanString(input.name, "El nombre");
		const price = ensurePositiveInt(input.price, "El precio");
		const stock = ensureNonNegativeInt(input.stock, "El stock");

		// Leer nextProductId ANTES de crear para saber qué ID se asignará
		const nextProductId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "nextProductId",
		}) as bigint;
		const productId = Number(nextProductId);

		// 1. Registrar on-chain
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "addProduct",
			args: [BigInt(price), BigInt(stock)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción de creación de producto fue revertida");
		}

		// 2. Guardar metadatos en Prisma
		const product = await prisma.product.create({
			data: {
				productId,
				name,
				description: input.description?.trim() || null,
				price,
				stock,
				category: input.category?.trim() || null,
				imageUrl: input.imageUrl?.trim() || null,
			},
		});

		return { ...product, txHash: hash };
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al crear producto: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Actualiza un producto existente (on-chain + Prisma).
 * Acceso: solo admin.
 */
export async function updateProduct(
	productPrismaId: string,
	input: {
		name?: string;
		description?: string;
		price?: number;
		stock?: number;
		category?: string;
		imageUrl?: string;
	},
) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		// Obtener el producto actual para saber su productId on-chain
		const existing = await prisma.product.findUnique({
			where: { id: productPrismaId },
		});
		if (!existing) throw new Error("Producto no encontrado");

		const newPrice = input.price !== undefined ? ensurePositiveInt(input.price, "El precio") : existing.price;
		const newStock = input.stock !== undefined ? ensureNonNegativeInt(input.stock, "El stock") : existing.stock;

		// Actualizar on-chain si precio o stock cambiaron
		if (newPrice !== existing.price || newStock !== existing.stock) {
			const hash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "updateProduct",
				args: [BigInt(existing.productId), BigInt(newPrice), BigInt(newStock)],
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash });
			if (receipt.status !== "success") {
				throw new Error("La transacción de actualización fue revertida");
			}
		}

		// Actualizar metadatos en Prisma
		const product = await prisma.product.update({
			where: { id: productPrismaId },
			data: {
				name: input.name !== undefined ? cleanString(input.name, "El nombre") : undefined,
				description: input.description !== undefined ? input.description.trim() || null : undefined,
				price: newPrice,
				stock: newStock,
				category: input.category !== undefined ? input.category.trim() || null : undefined,
				imageUrl: input.imageUrl !== undefined ? input.imageUrl.trim() || null : undefined,
			},
		});

		return product;
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Producto no encontrado")) throw error;
		throw new Error(`Error al actualizar producto: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Desactiva un producto (soft delete on-chain + Prisma).
 * Acceso: solo admin.
 */
export async function deactivateProduct(productPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const product = await prisma.product.findUnique({ where: { id: productPrismaId } });
		if (!product) throw new Error("Producto no encontrado");

		// Desactivar on-chain
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "deactivateProduct",
			args: [BigInt(product.productId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción de desactivación fue revertida");
		}

		// Desactivar en Prisma
		return await prisma.product.update({
			where: { id: productPrismaId },
			data: { active: false },
		});
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Producto no encontrado")) throw error;
		throw new Error(`Error al desactivar producto: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Reactiva un producto previamente desactivado (on-chain + Prisma).
 * Acceso: solo admin.
 */
export async function reactivateProduct(productPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const product = await prisma.product.findUnique({ where: { id: productPrismaId } });
		if (!product) throw new Error("Producto no encontrado");

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "reactivateProduct",
			args: [BigInt(product.productId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción de reactivación fue revertida");
		}

		return await prisma.product.update({
			where: { id: productPrismaId },
			data: { active: true },
		});
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Producto no encontrado")) throw error;
		throw new Error(`Error al reactivar producto: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Balance de ShopTokens ────────────────────────────────────────────────

/**
 * Obtiene el balance de ShopTokens del usuario logueado.
 * Acceso: estudiantes y profesores.
 */
export async function getMyShopBalance() {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	try {
		const address = await getUserAddressById(session.userId!);
		const balance = await readShopBalance(address);
		return {
			userAddress: address,
			balance: Number(balance),
		};
	} catch (error) {
		throw new Error(`Error al obtener balance: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene el balance de ShopTokens de un usuario específico (admin).
 * Acceso: solo admin.
 */
export async function getStudentShopBalance(userId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const address = await getUserAddressById(userId);
		const balance = await readShopBalance(address);
		return {
			userId,
			userAddress: address,
			balance: Number(balance),
		};
	} catch (error) {
		throw new Error(`Error al obtener balance del estudiante: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Mintea ShopTokens a un usuario (admin).
 * Acceso: solo admin.
 */
export async function mintShopTokens(userId: string, amount: number) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const normalizedAmount = ensurePositiveInt(amount, "La cantidad");
		const address = await getUserAddressById(userId);

		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.shopToken as `0x${string}`,
			abi: SHOP_TOKEN_ABI,
			functionName: "mint",
			args: [address, BigInt(normalizedAmount)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción de minteo fue revertida");
		}

		const updatedBalance = await readShopBalance(address);

		return {
			txHash: hash,
			userId,
			userAddress: address,
			balance: Number(updatedBalance),
		};
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado") throw error;
		throw new Error(`Error al mintear tokens: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Compras ──────────────────────────────────────────────────────────────

/**
 * Realiza una compra como el usuario logueado.
 * La transacción se firma con la wallet custodial del estudiante
 * (el contrato verifica msg.sender con onlyStudent).
 *
 * Flujo:
 * 1. Descifra la wallet del usuario desde la BD
 * 2. Llama a CampusShop.purchase(productId) firmada por el estudiante
 * 3. Obtiene el orderId del evento OrderCreated
 * 4. Guarda la orden en Prisma con el txHash
 *
 * Acceso: estudiantes y profesores.
 */
export async function purchaseProduct(productPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	try {
		// Obtener producto de Prisma
		const product = await prisma.product.findUnique({
			where: { id: productPrismaId },
		});
		if (!product) throw new Error("Producto no encontrado");
		if (!product.active) throw new Error("Producto no disponible");
		if (product.stock <= 0) throw new Error("Producto sin stock");

		// Crear walletClient del usuario para firmar la tx
		const { walletClient, address } = await getUserWalletClient(session.userId!);

		// Verificar balance antes de intentar la compra
		const balance = await readShopBalance(address);
		if (Number(balance) < product.price) {
			throw new Error(`Saldo insuficiente. Tienes ${Number(balance)} SHPT y el producto cuesta ${product.price} SHPT`);
		}

		// Leer el nextOrderId ANTES de la compra para saber qué orderId se asignará
		const nextOrderId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "nextOrderId",
		}) as bigint;
		const orderId = Number(nextOrderId);

		// Ejecutar compra on-chain (firmada por el estudiante)
		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "purchase",
			args: [BigInt(product.productId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción de compra fue revertida");
		}

		// Actualizar stock en Prisma
		await prisma.product.update({
			where: { id: productPrismaId },
			data: { stock: { decrement: 1 } },
		});

		// Guardar orden en Prisma
		const order = await prisma.order.create({
			data: {
				orderId,
				userId: session.userId!,
				productId: productPrismaId,
				pricePaid: product.price,
				status: "PAID",
				txHash: hash,
			},
		});

		return {
			...order,
			productName: product.name,
			balance: Number(balance) - product.price,
		};
	} catch (error) {
		if (error instanceof Error && (
			error.message === "No autorizado" ||
			error.message === "Producto no encontrado" ||
			error.message === "Producto no disponible" ||
			error.message === "Producto sin stock" ||
			error.message.startsWith("Saldo insuficiente")
		)) throw error;
		throw new Error(`Error al realizar la compra: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Pedidos: Lectura ─────────────────────────────────────────────────────

/**
 * Lista los pedidos del usuario logueado con paginación.
 * Acceso: estudiantes y profesores.
 */
export async function listMyOrders(limit = 20, offset = 0) {
	const safeLimit = Math.min(Math.max(limit, 1), 100);
	const safeOffset = Math.max(offset, 0);

	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	try {
		const [orders, total] = await Promise.all([
			prisma.order.findMany({
				where: { userId: session.userId },
				include: {
					product: {
						select: { name: true, imageUrl: true, category: true },
					},
				},
				orderBy: { purchaseDate: "desc" },
				take: safeLimit,
				skip: safeOffset,
			}),
			prisma.order.count({ where: { userId: session.userId } }),
		]);

		return { orders, total };
	} catch (error) {
		throw new Error(`Error al listar pedidos: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene el detalle de un pedido individual.
 * El usuario solo puede ver sus propios pedidos. Los admins pueden ver cualquiera.
 */
export async function getOrderDetail(orderPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		const order = await prisma.order.findUnique({
			where: { id: orderPrismaId },
			include: {
				product: true,
				user: {
					select: { id: true, name: true, email: true, role: true },
				},
			},
		});

		if (!order) throw new Error("Pedido no encontrado");

		// Los no-admin solo pueden ver sus propios pedidos
		if (session.role !== "ADMIN" && order.userId !== session.userId) {
			throw new Error("No autorizado");
		}

		return order;
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Pedido no encontrado")) throw error;
		throw new Error(`Error al obtener detalle del pedido: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todos los pedidos del sistema con paginación y filtros (admin).
 * Acceso: solo admin.
 */
export async function listAllOrders(
	limit = 50,
	offset = 0,
	userId?: string,
	status?: string,
) {
	const safeLimit = Math.min(Math.max(limit, 1), 200);
	const safeOffset = Math.max(offset, 0);

	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const where: Record<string, unknown> = {};
		if (userId) where.userId = userId;
		if (status) where.status = status;

		const [orders, total] = await Promise.all([
			prisma.order.findMany({
				where,
				include: {
					product: {
						select: { name: true, imageUrl: true, category: true },
					},
					user: {
						select: { id: true, name: true, email: true, role: true },
					},
				},
				orderBy: { purchaseDate: "desc" },
				take: safeLimit,
				skip: safeOffset,
			}),
			prisma.order.count({ where }),
		]);

		return { orders, total };
	} catch (error) {
		throw new Error(`Error al listar pedidos: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Pedidos: Gestión ─────────────────────────────────────────────────────

/**
 * Marca un pedido como entregado (admin).
 * Llama a CampusShop.markDelivered(orderId) on-chain.
 * Acceso: solo admin.
 */
export async function markOrderDelivered(orderPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const order = await prisma.order.findUnique({ where: { id: orderPrismaId } });
		if (!order) throw new Error("Pedido no encontrado");
		if (order.status !== "PAID") throw new Error("Solo se pueden marcar como entregados pedidos en estado PAGADO");

		// Marcar entregado on-chain
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "markDelivered",
			args: [BigInt(order.orderId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción fue revertida");
		}

		// Actualizar en Prisma
		return await prisma.order.update({
			where: { id: orderPrismaId },
			data: {
				status: "DELIVERED",
				deliveryDate: new Date(),
			},
		});
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Pedido no encontrado" || error.message.startsWith("Solo se pueden"))) throw error;
		throw new Error(`Error al marcar como entregado: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Procesa la devolución de un pedido (admin, sin límite de tiempo).
 * Quema el NFT recibo, reembolsa ShopTokens y restaura stock.
 * Acceso: solo admin.
 */
export async function processReturn(orderPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const order = await prisma.order.findUnique({
			where: { id: orderPrismaId },
			include: { product: { select: { id: true, productId: true } } },
		});
		if (!order) throw new Error("Pedido no encontrado");
		if (order.status === "RETURNED") throw new Error("El pedido ya fue devuelto");
		if (order.status !== "PAID" && order.status !== "DELIVERED") {
			throw new Error("Solo se pueden devolver pedidos pagados o entregados");
		}

		// Procesar devolución on-chain
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "processReturn",
			args: [BigInt(order.orderId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción de devolución fue revertida");
		}

		// Actualizar en Prisma: orden como devuelta + restaurar stock
		const [updatedOrder] = await prisma.$transaction([
			prisma.order.update({
				where: { id: orderPrismaId },
				data: {
					status: "RETURNED",
					returnDate: new Date(),
				},
			}),
			prisma.product.update({
				where: { id: order.product.id },
				data: { stock: { increment: 1 } },
			}),
		]);

		return updatedOrder;
	} catch (error) {
		if (error instanceof Error && (
			error.message === "No autorizado" ||
			error.message === "Pedido no encontrado" ||
			error.message === "El pedido ya fue devuelto" ||
			error.message.startsWith("Solo se pueden")
		)) throw error;
		throw new Error(`Error al procesar devolución: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * El estudiante solicita la devolución de un pedido (dentro de 30 días).
 * La transacción se firma con la wallet del estudiante.
 * Acceso: estudiantes y profesores (dueños del pedido).
 */
export async function requestReturn(orderPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	try {
		const order = await prisma.order.findUnique({
			where: { id: orderPrismaId },
			include: { product: { select: { id: true, productId: true } } },
		});
		if (!order) throw new Error("Pedido no encontrado");
		if (order.userId !== session.userId) throw new Error("No autorizado");
		if (order.status !== "DELIVERED") throw new Error("Solo se pueden devolver pedidos entregados");

		// Verificar ventana de devolución (30 días desde entrega)
		if (order.deliveryDate) {
			const daysSinceDelivery = (Date.now() - order.deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
			if (daysSinceDelivery > 30) {
				throw new Error("El plazo de devolución de 30 días ha expirado");
			}
		}

		// Firmar con la wallet del estudiante
		const { walletClient } = await getUserWalletClient(session.userId!);

		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "requestReturn",
			args: [BigInt(order.orderId)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción de devolución fue revertida");
		}

		// Actualizar en Prisma
		const [updatedOrder] = await prisma.$transaction([
			prisma.order.update({
				where: { id: orderPrismaId },
				data: {
					status: "RETURNED",
					returnDate: new Date(),
				},
			}),
			prisma.product.update({
				where: { id: order.product.id },
				data: { stock: { increment: 1 } },
			}),
		]);

		return updatedOrder;
	} catch (error) {
		if (error instanceof Error && (
			error.message === "No autorizado" ||
			error.message === "Pedido no encontrado" ||
			error.message === "Solo se pueden devolver pedidos entregados" ||
			error.message === "El plazo de devolución de 30 días ha expirado"
		)) throw error;
		throw new Error(`Error al solicitar devolución: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Estadísticas (admin) ─────────────────────────────────────────────────

/**
 * Obtiene estadísticas generales de la tienda para el panel del admin.
 * Acceso: solo admin.
 */
export async function getShopStats() {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const [
			totalProducts,
			activeProducts,
			totalOrders,
			ordersByStatus,
		] = await Promise.all([
			prisma.product.count(),
			prisma.product.count({ where: { active: true } }),
			prisma.order.count(),
			prisma.order.groupBy({
				by: ["status"],
				_count: { id: true },
			}),
		]);

		const statusCounts = {
			PAID: 0,
			DELIVERED: 0,
			RETURNED: 0,
		};
		for (const group of ordersByStatus) {
			statusCounts[group.status] = group._count.id;
		}

		return {
			totalProducts,
			activeProducts,
			totalOrders,
			...statusCounts,
		};
	} catch (error) {
		throw new Error(`Error al obtener estadísticas: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}
