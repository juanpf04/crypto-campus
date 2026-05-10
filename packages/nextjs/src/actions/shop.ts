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

import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getSession, ensureRole } from "@/lib/auth";
import { isContractPauseError, translateContractError } from "@/lib/contractErrors";
import { ensureOnChainId, ONLY_LIVE } from "@/lib/historical";
import { adminWalletClient, publicClient } from "@/lib/viem";
import {
	CONTRACT_ADDRESSES,
	CAMPUS_SHOP_ABI,
	SHOP_TOKEN_ABI,
} from "@/lib/contracts";
import { hasRewardOfType, issueReward, ShopTokenRewardReason, REWARD_DESCRIPTIONS, type RewardGrant } from "@/lib/shopRewards";
import {
	type ProductGroupSummary,
	type ProductVariantSummary,
	normalizeColor,
	deriveColorFromImageUrl,
	deriveBaseKeyFromImageUrl,
	slugify,
	deriveBaseName,
} from "@/lib/shop-utils";

// ── Tipos ────────────────────────────────────────────────────────────────

type SimulatedCardInput = {
	cardNumber: string;
	expiryMonth: number;
	expiryYear: number;
	cvv: string;
	amount: number;
};

// ── Helpers internos ─────────────────────────────────────────────────────

function luhnCheck(cardNumber: string): boolean {
	const digits = cardNumber.replace(/\s+/g, "");
	if (!/^\d{13,19}$/.test(digits)) return false;

	let sum = 0;
	let shouldDouble = false;
	for (let i = digits.length - 1; i >= 0; i -= 1) {
		let value = Number(digits[i]);
		if (shouldDouble) {
			value *= 2;
			if (value > 9) value -= 9;
		}
		sum += value;
		shouldDouble = !shouldDouble;
	}

	return sum % 10 === 0;
}

function getCardBrand(cardNumber: string): string {
	const digits = cardNumber.replace(/\s+/g, "");
	if (/^4\d{12}(\d{3})?(\d{3})?$/.test(digits)) return "VISA";
	if (/^(5[1-5]\d{14}|2[2-7]\d{14})$/.test(digits)) return "MASTERCARD";
	if (/^3[47]\d{13}$/.test(digits)) return "AMEX";
	return "OTHER";
}

function validateSimulatedCardInput(input: SimulatedCardInput) {
	const amount = ensurePositiveInt(input.amount, "La cantidad");
	if (amount > 1000) {
		throw new Error("La recarga maxima por operacion es de 1000 ShopTokens");
	}

	const cardNumber = input.cardNumber.replace(/\s+/g, "");
	if (!luhnCheck(cardNumber)) {
		throw new Error("Tarjeta simulada invalida");
	}

	if (!/^\d{3,4}$/.test(input.cvv)) {
		throw new Error("CVV invalido");
	}

	const month = ensurePositiveInt(input.expiryMonth, "El mes de expiracion");
	if (month < 1 || month > 12) {
		throw new Error("Mes de expiracion invalido");
	}

	const year = ensurePositiveInt(input.expiryYear, "El anio de expiracion");
	const now = new Date();
	const expiryBoundary = new Date(year, month, 0, 23, 59, 59, 999);
	if (expiryBoundary < now) {
		throw new Error("La tarjeta simulada esta expirada");
	}

	return {
		amount,
		cardNumber,
		expiryMonth: month,
		expiryYear: year,
		cardLast4: cardNumber.slice(-4),
		cardBrand: getCardBrand(cardNumber),
	};
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
 * Lista el catalogo agrupado por producto base con variantes de color.
 * Acceso: cualquier usuario autenticado.
 */
export async function listGroupedProducts(category?: string): Promise<ProductGroupSummary[]> {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "LIBRARIAN", "ADMIN"]);

	try {
		const where: Record<string, unknown> = { active: true };
		if (category) where.category = category;

		const products = await prisma.product.findMany({
			where,
			include: {
				base: {
					select: { slug: true, name: true, description: true, category: true },
				},
			},
			orderBy: [
				{ category: "asc" },
				{ baseId: "asc" },
				{ sortOrder: "asc" },
				{ name: "asc" },
			],
		});

		const groups = new Map<string, ProductGroupSummary>();

		for (const product of products) {
			const color = normalizeColor(product.color ?? deriveColorFromImageUrl(product.imageUrl));
			const fallbackBaseKey = deriveBaseKeyFromImageUrl(product.imageUrl) ?? slugify(product.name);
			const baseName = product.base?.name ?? deriveBaseName(product.name, color);
			const baseKey = product.base?.slug ?? fallbackBaseKey;
			const variant: ProductVariantSummary = {
				id: product.id,
				productId: product.productId,
				name: product.name,
				price: product.price,
				stock: product.stock,
				category: product.category,
				imageUrl: product.imageUrl,
				color,
				variantLabel: product.variantLabel,
			};

			if (!groups.has(baseKey)) {
				groups.set(baseKey, {
					groupKey: baseKey,
					name: baseName,
					category: product.base?.category ?? product.category,
					description: product.base?.description ?? product.description,
					price: product.price,
					minPrice: product.price,
					maxPrice: product.price,
					totalStock: Math.max(product.stock, 0),
					defaultVariantId: product.id,
					variants: [variant],
				});
				continue;
			}

			const current = groups.get(baseKey)!;
			current.minPrice = Math.min(current.minPrice, product.price);
			current.maxPrice = Math.max(current.maxPrice, product.price);
			current.totalStock += Math.max(product.stock, 0);
			current.variants.push(variant);
		}

		return [...groups.values()].map((group) => ({
			...group,
			variants: group.variants.sort((a, b) => a.color.localeCompare(b.color)),
		}));
	} catch (error) {
		throw new Error(`Error al listar catalogo agrupado: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista TODOS los productos (activos e inactivos) para gestión del admin.
 * Acceso: solo admin. Devuelve productos individuales sin agrupar.
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
 * Lista todos los productos agrupados por base (activos + inactivos) para admin.
 * Incluye campo `active` por grupo.
 */
export async function listAllGroupedProducts(category?: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const where: Record<string, unknown> = {};
		if (category) where.category = category;

		const products = await prisma.product.findMany({
			where,
			include: {
				base: {
					select: { slug: true, name: true, description: true, category: true },
				},
			},
			orderBy: [
				{ category: "asc" },
				{ baseId: "asc" },
				{ sortOrder: "asc" },
				{ name: "asc" },
			],
		});

		const groups = new Map<string, ProductGroupSummary & { active: boolean }>();

		for (const product of products) {
			const color = normalizeColor(product.color ?? deriveColorFromImageUrl(product.imageUrl));
			const fallbackBaseKey = deriveBaseKeyFromImageUrl(product.imageUrl) ?? slugify(product.name);
			const baseName = product.base?.name ?? deriveBaseName(product.name, color);
			const baseKey = product.base?.slug ?? fallbackBaseKey;
			const variant: ProductVariantSummary = {
				id: product.id,
				productId: product.productId,
				name: product.name,
				price: product.price,
				stock: product.stock,
				category: product.category,
				imageUrl: product.imageUrl,
				color,
				variantLabel: product.variantLabel,
			};

			if (!groups.has(baseKey)) {
				groups.set(baseKey, {
					groupKey: baseKey,
					name: baseName,
					category: product.base?.category ?? product.category,
					description: product.base?.description ?? product.description,
					price: product.price,
					minPrice: product.price,
					maxPrice: product.price,
					totalStock: Math.max(product.stock, 0),
					defaultVariantId: product.id,
					active: product.active,
					variants: [variant],
				});
				continue;
			}

			const current = groups.get(baseKey)!;
			current.minPrice = Math.min(current.minPrice, product.price);
			current.maxPrice = Math.max(current.maxPrice, product.price);
			current.totalStock += Math.max(product.stock, 0);
			// Si al menos una variante está activa, el grupo está activo
			if (product.active) current.active = true;
			current.variants.push(variant);
		}

		return [...groups.values()].map((group) => ({
			...group,
			variants: group.variants.sort((a, b) => a.color.localeCompare(b.color)),
		}));
	} catch (error) {
		throw new Error(`Error al listar productos (admin): ${error instanceof Error ? error.message : "desconocido"}`);
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
			include: {
				base: { select: { slug: true, name: true, category: true } },
			},
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
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
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
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
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
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al reactivar producto: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Gestión de grupos y variantes ────────────────────────────────────────

/**
 * Obtiene el detalle completo de un grupo de producto (base + todas sus variantes).
 * Acceso: solo admin.
 */
export async function getProductGroup(groupKey: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		// Buscar la ProductBase por slug
		const base = await prisma.productBase.findUnique({
			where: { slug: groupKey },
			include: {
				variants: {
					orderBy: [{ sortOrder: "asc" }, { color: "asc" }],
				},
			},
		});

		if (!base) throw new Error("Grupo de producto no encontrado");

		const activeVariants = base.variants.filter((v) => v.active);
		const allPrices = base.variants.map((v) => v.price);
		const totalStock = base.variants.reduce((sum, v) => sum + Math.max(v.stock, 0), 0);

		return {
			groupKey: base.slug,
			name: base.name,
			description: base.description,
			category: base.category,
			active: base.active,
			totalStock,
			minPrice: Math.min(...allPrices),
			maxPrice: Math.max(...allPrices),
			activeVariantsCount: activeVariants.length,
			variants: base.variants.map((v) => ({
				id: v.id,
				productId: v.productId,
				name: v.name,
				price: v.price,
				stock: v.stock,
				imageUrl: v.imageUrl,
				color: normalizeColor(v.color),
				variantLabel: v.variantLabel,
				active: v.active,
				sortOrder: v.sortOrder,
			})),
		};
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Grupo de producto no encontrado")) throw error;
		throw new Error(`Error al obtener grupo: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Actualiza los campos compartidos de un grupo (nombre, descripción, categoría, precio).
 * El precio se actualiza on-chain para TODAS las variantes del grupo.
 * Acceso: solo admin.
 */
export async function updateProductGroup(
	groupKey: string,
	input: {
		name?: string;
		description?: string;
		category?: string;
		price?: number;
	},
) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const base = await prisma.productBase.findUnique({
			where: { slug: groupKey },
			include: { variants: true },
		});
		if (!base) throw new Error("Grupo de producto no encontrado");

		const newName = input.name !== undefined ? cleanString(input.name, "El nombre") : undefined;
		const newDescription = input.description !== undefined ? input.description.trim() || null : undefined;
		const newCategory = input.category !== undefined ? input.category.trim() || null : undefined;
		const newPrice = input.price !== undefined ? ensurePositiveInt(input.price, "El precio") : undefined;

		// Si el precio cambió, actualizar on-chain cada variante
		if (newPrice !== undefined) {
			for (const variant of base.variants) {
				if (variant.price !== newPrice) {
					const hash = await adminWalletClient.writeContract({
						address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
						abi: CAMPUS_SHOP_ABI,
						functionName: "updateProduct",
						args: [BigInt(variant.productId), BigInt(newPrice), BigInt(variant.stock)],
					});
					const receipt = await publicClient.waitForTransactionReceipt({ hash });
					if (receipt.status !== "success") {
						throw new Error(`La transacción de actualización de la variante #${variant.productId} fue revertida`);
					}
				}
			}
		}

		// Actualizar ProductBase en Prisma
		await prisma.productBase.update({
			where: { slug: groupKey },
			data: {
				...(newName !== undefined && { name: newName }),
				...(newDescription !== undefined && { description: newDescription }),
				...(newCategory !== undefined && { category: newCategory }),
			},
		});

		// Actualizar variantes en Prisma (precio + categoría se sincronizan)
		const variantUpdateData: Record<string, unknown> = {};
		if (newPrice !== undefined) variantUpdateData.price = newPrice;
		if (newCategory !== undefined) variantUpdateData.category = newCategory;

		if (Object.keys(variantUpdateData).length > 0) {
			await prisma.product.updateMany({
				where: { baseId: base.id },
				data: variantUpdateData,
			});
		}

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Grupo de producto no encontrado")) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al actualizar grupo: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Actualiza una variante individual (nombre, color, stock, imagen).
 * El stock se actualiza on-chain.
 * Acceso: solo admin.
 */
export async function updateVariant(
	variantPrismaId: string,
	input: {
		name?: string;
		color?: string;
		variantLabel?: string;
		stock?: number;
		imageUrl?: string;
	},
) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const variant = await prisma.product.findUnique({
			where: { id: variantPrismaId },
		});
		if (!variant) throw new Error("Variante no encontrada");

		const newStock = input.stock !== undefined ? ensureNonNegativeInt(input.stock, "El stock") : undefined;

		// Actualizar on-chain si stock cambió
		if (newStock !== undefined && newStock !== variant.stock) {
			const hash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "updateProduct",
				args: [BigInt(variant.productId), BigInt(variant.price), BigInt(newStock)],
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash });
			if (receipt.status !== "success") {
				throw new Error("La transacción de actualización de la variante fue revertida");
			}
		}

		// Actualizar en Prisma
		return await prisma.product.update({
			where: { id: variantPrismaId },
			data: {
				...(input.name !== undefined && { name: cleanString(input.name, "El nombre") }),
				...(input.color !== undefined && { color: input.color.trim() || null }),
				...(input.variantLabel !== undefined && { variantLabel: input.variantLabel.trim() || null }),
				...(newStock !== undefined && { stock: newStock }),
				...(input.imageUrl !== undefined && { imageUrl: input.imageUrl.trim() || null }),
			},
		});
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Variante no encontrada")) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al actualizar variante: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Añade una nueva variante a un grupo existente.
 * Crea el producto on-chain (con el precio del grupo) y en Prisma.
 * Acceso: solo admin.
 */
export async function addVariantToGroup(
	groupKey: string,
	input: {
		name: string;
		color: string;
		variantLabel?: string;
		stock: number;
		imageUrl?: string;
	},
) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const base = await prisma.productBase.findUnique({
			where: { slug: groupKey },
			include: { variants: { take: 1, orderBy: { createdAt: "asc" } } },
		});
		if (!base) throw new Error("Grupo de producto no encontrado");
		if (base.variants.length === 0) throw new Error("El grupo no tiene variantes de referencia");

		const referenceVariant = base.variants[0];
		const price = referenceVariant.price;
		const stock = ensureNonNegativeInt(input.stock, "El stock");
		const color = normalizeColor(input.color);
		const variantName = cleanString(input.name, "El nombre");

		// Leer nextProductId
		const nextProductId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "nextProductId",
		}) as bigint;
		const productId = Number(nextProductId);

		// Crear on-chain
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "addProduct",
			args: [BigInt(price), BigInt(stock)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción de creación fue revertida");
		}

		// Crear en Prisma
		const newVariant = await prisma.product.create({
			data: {
				productId,
				baseId: base.id,
				name: variantName,
				color,
				variantLabel: input.variantLabel?.trim() || null,
				price,
				stock,
				category: base.category,
				imageUrl: input.imageUrl?.trim() || null,
				sortOrder: base.variants.length,
			},
		});

		return { ...newVariant, txHash: hash };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Grupo de producto no encontrado")) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al añadir variante: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Crea un nuevo producto (grupo + primera variante).
 * Crea la ProductBase, el producto on-chain y el registro en Prisma.
 * Acceso: solo admin.
 */
export async function createProductGroup(input: {
	name: string;
	variantName: string;
	description?: string;
	category?: string;
	price: number;
	stock: number;
	color: string;
	imageUrl?: string;
}) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const variantName = cleanString(input.variantName ?? input.name, "El nombre de la variante");
		const price = ensurePositiveInt(input.price, "El precio");
		const stock = ensureNonNegativeInt(input.stock, "El stock");
		const color = normalizeColor(input.color);

		// Derivar nombre del grupo quitando el color del nombre de la variante
		const groupName = deriveBaseName(variantName, color);
		const slug = slugify(groupName);

		// Verificar que no exista ya un grupo con el mismo slug
		const existing = await prisma.productBase.findUnique({ where: { slug } });
		if (existing) throw new Error(`Ya existe un grupo de producto con el nombre "${groupName}"`);

		// Leer nextProductId
		const nextProductId = await publicClient.readContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "nextProductId",
		}) as bigint;
		const productId = Number(nextProductId);

		// Crear on-chain
		const hash = await adminWalletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "addProduct",
			args: [BigInt(price), BigInt(stock)],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success") {
			throw new Error("La transacción de creación fue revertida");
		}

		// Crear ProductBase (nombre derivado del nombre de la variante sin color)
		const base = await prisma.productBase.create({
			data: {
				slug,
				name: groupName,
				description: input.description?.trim() || null,
				category: input.category?.trim() || null,
			},
		});

		// Crear primera variante
		const variant = await prisma.product.create({
			data: {
				productId,
				baseId: base.id,
				name: variantName,
				color,
				price,
				stock,
				category: input.category?.trim() || null,
				imageUrl: input.imageUrl?.trim() || null,
				sortOrder: 0,
			},
		});

		return { groupKey: slug, variant, txHash: hash };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message.startsWith("Ya existe"))) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al crear producto: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Desactiva/reactiva un grupo entero (todas sus variantes).
 * Acceso: solo admin.
 */
export async function toggleGroupActive(groupKey: string, active: boolean) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const base = await prisma.productBase.findUnique({
			where: { slug: groupKey },
			include: { variants: true },
		});
		if (!base) throw new Error("Grupo de producto no encontrado");

		// Actualizar cada variante on-chain
		for (const variant of base.variants) {
			const fn = active ? "reactivateProduct" : "deactivateProduct";
			// Solo cambiar si el estado actual es diferente
			if (variant.active !== active) {
				const hash = await adminWalletClient.writeContract({
					address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
					abi: CAMPUS_SHOP_ABI,
					functionName: fn,
					args: [BigInt(variant.productId)],
				});
				await publicClient.waitForTransactionReceipt({ hash });
			}
		}

		// Actualizar ProductBase
		await prisma.productBase.update({
			where: { slug: groupKey },
			data: { active },
		});

		// Actualizar todas las variantes en Prisma
		await prisma.product.updateMany({
			where: { baseId: base.id },
			data: { active },
		});

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Grupo de producto no encontrado")) throw error;
		throw new Error(`Error al cambiar estado del grupo: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Desactiva/reactiva una variante individual.
 * Si es la última activa del grupo, desactiva también el grupo.
 * Acceso: solo admin.
 */
export async function toggleVariantActive(variantPrismaId: string, active: boolean) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const variant = await prisma.product.findUnique({
			where: { id: variantPrismaId },
			include: { base: { include: { variants: true } } },
		});
		if (!variant) throw new Error("Variante no encontrada");

		// Actualizar on-chain
		const fn = active ? "reactivateProduct" : "deactivateProduct";
		if (variant.active !== active) {
			const hash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: fn,
				args: [BigInt(variant.productId)],
			});
			await publicClient.waitForTransactionReceipt({ hash });
		}

		// Actualizar variante en Prisma
		await prisma.product.update({
			where: { id: variantPrismaId },
			data: { active },
		});

		// Si desactivamos y es la última activa, desactivar el grupo
		if (!active && variant.base) {
			const otherActive = variant.base.variants.filter(
				(v) => v.id !== variantPrismaId && v.active,
			);
			if (otherActive.length === 0) {
				await prisma.productBase.update({
					where: { id: variant.base.id },
					data: { active: false },
				});
			}
		}

		// Si reactivamos, asegurarnos de que el grupo esté activo
		if (active && variant.base) {
			await prisma.productBase.update({
				where: { id: variant.base.id },
				data: { active: true },
			});
		}

		return { success: true };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Variante no encontrada")) throw error;
		throw new Error(`Error al cambiar estado de variante: ${error instanceof Error ? error.message : "desconocido"}`);
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

async function mintShopTokensInternal(userId: string, amount: number) {
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
		throw new Error("La transaccion de minteo fue revertida");
	}

	const updatedBalance = await readShopBalance(address);

	return {
		txHash: hash,
		userId,
		userAddress: address,
		balance: Number(updatedBalance),
	};
}

/**
 * Asigna un balance absoluto de ShopTokens a un usuario (admin).
 * Mintea o quema la diferencia respecto al balance actual para alcanzar el target.
 * Acceso: solo admin.
 *
 * @param userId ID del usuario.
 * @param amount Balance objetivo (entero ≥ 0).
 * @returns txHash, address y balance final.
 */
export async function mintShopTokens(userId: string, amount: number) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		if (!Number.isInteger(amount) || amount < 0) {
			throw new Error("La cantidad debe ser un entero no negativo");
		}

		const address = await getUserAddressById(userId);
		const currentBalance = await readShopBalance(address);
		const current = Number(currentBalance);

		let txHash: `0x${string}` | null = null;

		if (amount > current) {
			const toMint = amount - current;
			txHash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.shopToken as `0x${string}`,
				abi: SHOP_TOKEN_ABI,
				functionName: "mint",
				args: [address, BigInt(toMint)],
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
			if (receipt.status !== "success") {
				throw new Error("La transacción de mint fue revertida");
			}
		} else if (amount < current) {
			const toBurn = current - amount;
			txHash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.shopToken as `0x${string}`,
				abi: SHOP_TOKEN_ABI,
				functionName: "burn",
				args: [address, BigInt(toBurn)],
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
			if (receipt.status !== "success") {
				throw new Error("La transacción de burn fue revertida");
			}
		}

		const updatedBalance = await readShopBalance(address);

		return {
			txHash,
			userId,
			userAddress: address,
			balance: Number(updatedBalance),
		};
	} catch (error) {
		if (error instanceof Error && (error.message === "No autenticado" || error.message === "No autorizado")) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al asignar tokens: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Recarga simulada por tarjeta para el usuario autenticado.
 * Seguridad: nunca persiste PAN completo ni CVV.
 */
export async function topupWithSimulatedCard(input: SimulatedCardInput) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	const validated = validateSimulatedCardInput(input);
	const now = new Date();
	const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

	const [dailyOps, monthlyAmount] = await Promise.all([
		prisma.cardTopupSimulation.count({
			where: {
				userId: session.userId!,
				createdAt: { gte: oneDayAgo },
			},
		}),
		prisma.cardTopupSimulation.aggregate({
			where: {
				userId: session.userId!,
				status: "SUCCESS",
				createdAt: { gte: monthStart },
			},
			_sum: { amount: true },
		}),
	]);

	if (dailyOps >= 10) {
		throw new Error("Has alcanzado el limite diario de recargas simuladas");
	}

	if ((monthlyAmount._sum.amount ?? 0) + validated.amount > 10000) {
		throw new Error("Has alcanzado el limite mensual de recargas simuladas");
	}

	const simulation = await prisma.cardTopupSimulation.create({
		data: {
			userId: session.userId!,
			amount: validated.amount,
			cardBrand: validated.cardBrand,
			cardLast4: validated.cardLast4,
			expiryMonth: validated.expiryMonth,
			expiryYear: validated.expiryYear,
			status: "PENDING",
		},
	});

	try {
		const mintResult = await mintShopTokensInternal(session.userId!, validated.amount);

		await prisma.cardTopupSimulation.update({
			where: { id: simulation.id },
			data: { status: "SUCCESS", txHash: mintResult.txHash },
		});

		return {
			simulationId: simulation.id,
			txHash: mintResult.txHash,
			newBalance: mintResult.balance,
			amount: validated.amount,
			cardBrand: validated.cardBrand,
			cardLast4: validated.cardLast4,
		};
	} catch (error) {
		const reason = error instanceof Error ? error.message : "error_desconocido";

		await prisma.cardTopupSimulation.update({
			where: { id: simulation.id },
			data: { status: "FAILED", errorReason: reason },
		});

		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al recargar saldo: ${reason}`);
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
/**
 * Compra rápida: compra un producto directamente sin pasar por el carrito.
 * Usa purchaseBatch internamente para crear siempre un ticket (batch).
 * Después marca todos los artículos como entregados automáticamente (simulación).
 * Acceso: estudiantes y profesores.
 */
export async function quickPurchase(productPrismaId: string, quantity = 1) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	try {
		const safeQuantity = Math.max(1, Math.min(quantity, 50));

		// Obtener producto de Prisma
		const product = await prisma.product.findUnique({
			where: { id: productPrismaId },
		});
		if (!product) throw new Error("Producto no encontrado");
		if (!product.active) throw new Error("Producto no disponible");
		if (product.stock < safeQuantity) throw new Error(`Stock insuficiente. Disponibles: ${product.stock}`);

		const totalPrice = product.price * safeQuantity;

		// Wallet del usuario
		const { walletClient, address } = await getUserWalletClient(session.userId!);
		const balance = await readShopBalance(address);

		if (Number(balance) < totalPrice) {
			throw new Error(`Saldo insuficiente. Tienes ${Number(balance)} ShopTokens y necesitas ${totalPrice} ShopTokens`);
		}

		// Construir array de productIds (repetido por quantity)
		const productIdsOnChain: bigint[] = Array(safeQuantity).fill(BigInt(product.productId));

		// Leer IDs antes de la compra
		const [nextOrderIdRaw, nextBatchIdRaw] = await Promise.all([
			publicClient.readContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "nextOrderId",
			}) as Promise<bigint>,
			publicClient.readContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "nextBatchId",
			}) as Promise<bigint>,
		]);

		const firstOrderId = Number(nextOrderIdRaw);
		const batchId = Number(nextBatchIdRaw);

		// 1 sola transacción on-chain: purchaseBatch
		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "purchaseBatch",
			args: [productIdsOnChain],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción de compra fue revertida");
		}

		// Crear OrderBatch en Prisma
		const orderBatch = await prisma.orderBatch.create({
			data: {
				batchId,
				userId: session.userId!,
				totalPaid: totalPrice,
				txHash: hash,
			},
		});

		// Crear Orders individuales
		const orderIds: number[] = [];
		for (let i = 0; i < safeQuantity; i++) {
			const orderId = firstOrderId + i;
			orderIds.push(orderId);

			await prisma.order.create({
				data: {
					orderId,
					userId: session.userId!,
					productId: productPrismaId,
					batchId: orderBatch.id,
					pricePaid: product.price,
					status: "PAID",
					txHash: hash,
				},
			});
		}

		// Actualizar stock en Prisma
		await prisma.product.update({
			where: { id: productPrismaId },
			data: { stock: { decrement: safeQuantity } },
		});

		// Auto-deliver: marcar todos como entregados on-chain
		for (const orderId of orderIds) {
			const deliverHash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "markDelivered",
				args: [BigInt(orderId)],
			});
			await publicClient.waitForTransactionReceipt({ hash: deliverHash });
		}

		// Actualizar en Prisma a DELIVERED
		await prisma.order.updateMany({
			where: { ...ONLY_LIVE, batchId: orderBatch.id },
			data: { status: "DELIVERED", deliveryDate: new Date() },
		});

		const newBalance = await readShopBalance(address);

		return {
			success: true,
			batchId: orderBatch.id,
			ordersCreated: safeQuantity,
			totalPaid: totalPrice,
			newBalance: Number(newBalance),
		};
	} catch (error) {
		if (error instanceof Error && (
			error.message === "No autorizado" ||
			error.message === "Producto no encontrado" ||
			error.message === "Producto no disponible" ||
			error.message.startsWith("Stock insuficiente") ||
			error.message.startsWith("Saldo insuficiente")
		)) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al realizar la compra: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

async function getOrCreateCart(userId: string) {
	const existing = await prisma.cart.findUnique({
		where: { userId },
		include: {
			items: {
				include: {
					product: {
						select: {
							id: true,
							productId: true,
							name: true,
							price: true,
							stock: true,
							imageUrl: true,
							category: true,
							color: true,
							variantLabel: true,
							active: true,
						},
					},
				},
				orderBy: { createdAt: "asc" },
			},
		},
	});

	if (existing) return existing;

	return prisma.cart.create({
		data: { userId },
		include: {
			items: {
				include: {
					product: {
						select: {
							id: true,
							name: true,
							price: true,
							stock: true,
							imageUrl: true,
							category: true,
							color: true,
							variantLabel: true,
							active: true,
						},
					},
				},
				orderBy: { createdAt: "asc" },
			},
		},
	});
}

function buildCartSummary(cart: Awaited<ReturnType<typeof getOrCreateCart>>) {
	const items = cart.items.map((item) => ({
		id: item.id,
		productId: item.productId,
		name: item.product.name,
		price: item.product.price,
		quantity: item.quantity,
		stock: item.product.stock,
		imageUrl: item.product.imageUrl,
		category: item.product.category,
		color: item.product.color,
		variantLabel: item.product.variantLabel,
		subtotal: item.product.price * item.quantity,
	}));

	const total = items.reduce((acc, item) => acc + item.subtotal, 0);

	return {
		id: cart.id,
		userId: cart.userId,
		items,
		total,
	};
}

/**
 * Obtiene el carrito del usuario autenticado.
 */
export async function getMyCart() {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	const cart = await getOrCreateCart(session.userId!);
	return buildCartSummary(cart);
}

/**
 * Agrega una variante al carrito.
 */
export async function addToCart(productId: string, quantity = 1) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	const normalizedQuantity = ensurePositiveInt(quantity, "La cantidad");
	const product = await prisma.product.findUnique({ where: { id: productId } });
	if (!product || !product.active) throw new Error("Producto no disponible");
	if (product.stock < normalizedQuantity) throw new Error("Stock insuficiente");

	const cart = await getOrCreateCart(session.userId!);
	const existingItem = cart.items.find((item) => item.productId === productId);

	if (existingItem) {
		const nextQuantity = existingItem.quantity + normalizedQuantity;
		if (nextQuantity > product.stock) throw new Error("Stock insuficiente");
		await prisma.cartItem.update({
			where: { id: existingItem.id },
			data: { quantity: nextQuantity },
		});
	} else {
		await prisma.cartItem.create({
			data: {
				cartId: cart.id,
				productId,
				quantity: normalizedQuantity,
			},
		});
	}

	return getMyCart();
}

/**
 * Actualiza la cantidad de un item del carrito.
 */
export async function updateCartItemQuantity(itemId: string, quantity: number) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	const normalizedQuantity = ensurePositiveInt(quantity, "La cantidad");
	const cart = await getOrCreateCart(session.userId!);
	const item = cart.items.find((entry) => entry.id === itemId);
	if (!item) throw new Error("Item de carrito no encontrado");

	if (!item.product.active || item.product.stock < normalizedQuantity) {
		throw new Error("Stock insuficiente");
	}

	await prisma.cartItem.update({
		where: { id: itemId },
		data: { quantity: normalizedQuantity },
	});

	return getMyCart();
}

/**
 * Elimina un item del carrito.
 */
export async function removeCartItem(itemId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	const cart = await getOrCreateCart(session.userId!);
	const item = cart.items.find((entry) => entry.id === itemId);
	if (!item) throw new Error("Item de carrito no encontrado");

	await prisma.cartItem.delete({ where: { id: itemId } });
	return getMyCart();
}

/**
 * Vacia el carrito del usuario autenticado.
 */
export async function clearMyCart() {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	const cart = await getOrCreateCart(session.userId!);
	await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
	return getMyCart();
}

/**
 * Procesa el pago de todos los items en el carrito del usuario.
 * Ejecuta una compra on-chain por cada item, crea registros de orden,
 * actualiza stocks y limpia el carrito al completar.
 * Acceso: estudiantes y profesores autenticados.
 */
export async function checkoutCart() {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	try {
		// 1. Obtener carrito con todos los items
		const cart = await getOrCreateCart(session.userId!);
		if (!cart || cart.items.length === 0) {
			throw new Error("El carrito está vacío");
		}

		// 2. Validar productos y calcular precio total
		let totalPrice = 0;
		// Expandir items con quantity > 1 en array plano de productIds on-chain
		const productIdsOnChain: bigint[] = [];

		for (const item of cart.items) {
			if (!item.product.active) {
				throw new Error(`El producto "${item.product.name}" no está disponible`);
			}
			if (item.product.stock < item.quantity) {
				throw new Error(`Stock insuficiente de "${item.product.name}". Disponibles: ${item.product.stock}, solicitados: ${item.quantity}`);
			}
			totalPrice += item.product.price * item.quantity;
			// Duplicar el productId tantas veces como quantity
			for (let i = 0; i < item.quantity; i++) {
				productIdsOnChain.push(BigInt(item.product.productId));
			}
		}

		// 3. Obtener wallet del usuario y verificar balance
		const { walletClient, address } = await getUserWalletClient(session.userId!);
		const balance = await readShopBalance(address);

		if (Number(balance) < totalPrice) {
			throw new Error(`Saldo insuficiente. Tienes ${Number(balance)} ShopTokens y necesitas ${totalPrice} ShopTokens`);
		}

		// 4. Leer nextOrderId y nextBatchId ANTES de la compra
		const [nextOrderIdRaw, nextBatchIdRaw] = await Promise.all([
			publicClient.readContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "nextOrderId",
			}) as Promise<bigint>,
			publicClient.readContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "nextBatchId",
			}) as Promise<bigint>,
		]);

		const firstOrderId = Number(nextOrderIdRaw);
		const batchId = Number(nextBatchIdRaw);

		// 5. UNA SOLA transacción on-chain: purchaseBatch
		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
			abi: CAMPUS_SHOP_ABI,
			functionName: "purchaseBatch",
			args: [productIdsOnChain],
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		if (receipt.status !== "success") {
			throw new Error("La transacción de compra fue revertida");
		}

		// 6. Crear OrderBatch en Prisma
		const orderBatch = await prisma.orderBatch.create({
			data: {
				batchId,
				userId: session.userId!,
				totalPaid: totalPrice,
				txHash: hash,
			},
		});

		// 7. Crear Orders individuales vinculados al batch
		const createdOrders = [];
		let orderIdCounter = firstOrderId;

		for (const item of cart.items) {
			for (let i = 0; i < item.quantity; i++) {
				const order = await prisma.order.create({
					data: {
						orderId: orderIdCounter,
						userId: session.userId!,
						productId: item.productId,
						batchId: orderBatch.id,
						pricePaid: item.product.price,
						status: "PAID",
						txHash: hash,
					},
				});
				createdOrders.push(order);
				orderIdCounter++;
			}

			// Actualizar stock en Prisma
			await prisma.product.update({
				where: { id: item.product.id },
				data: { stock: { decrement: item.quantity } },
			});
		}

		// 8. Auto-deliver: marcar todos como entregados on-chain (simulación)
		// Acabamos de crearlos con un orderId on-chain fresh; nunca son null aquí.
		for (const order of createdOrders) {
			const deliverHash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "markDelivered",
				args: [BigInt(order.orderId!)],
			});
			await publicClient.waitForTransactionReceipt({ hash: deliverHash });
		}

		// Actualizar en Prisma a DELIVERED
		await prisma.order.updateMany({
			where: { ...ONLY_LIVE, batchId: orderBatch.id },
			data: { status: "DELIVERED", deliveryDate: new Date() },
		});

		// 9. Limpiar el carrito
		await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

		// 10. Bonus de primer uso del módulo Tienda (solo estudiantes)
		let rewards: RewardGrant[] = [];
		if (session.role === "STUDENT") {
			const alreadyHad = await hasRewardOfType(
				session.userId!,
				ShopTokenRewardReason.MODULE_FIRST_USE_SHOP,
			);
			if (!alreadyHad) {
				rewards = await issueReward({
					userId: session.userId!,
					userAddress: address,
					mainReason: ShopTokenRewardReason.MODULE_FIRST_USE_SHOP,
				});
			}
		}

		const newBalance = await readShopBalance(address);

		return {
			success: true,
			batchId: orderBatch.id,
			ordersCreated: createdOrders.length,
			totalPaid: totalPrice,
			newBalance: Number(newBalance),
			rewards,
		};
	} catch (error) {
		if (error instanceof Error && (
			error.message === "No autorizado" ||
			error.message.includes("El carrito está vacío") ||
			error.message.includes("no está disponible") ||
			error.message.includes("Stock insuficiente") ||
			error.message.includes("Saldo insuficiente")
		)) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al procesar el pago: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Pedidos: Lectura ─────────────────────────────────────────────────────

/**
 * Lista los pedidos del usuario logueado con paginación.
 * Acceso: estudiantes y profesores.
 */
export async function listMyOrders(
	limit = 20,
	offset = 0,
	status?: string,
) {
	const safeLimit = Math.min(Math.max(limit, 1), 100);
	const safeOffset = Math.max(offset, 0);

	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	try {
		// Los pedidos históricos solo alimentan estadísticas; no se listan.
		const where: Record<string, unknown> = { ...ONLY_LIVE, userId: session.userId };
		if (status) where.status = status;

		const [orders, total] = await Promise.all([
			prisma.order.findMany({
				where,
				include: {
					product: {
						select: { name: true, imageUrl: true, category: true },
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

		// Tratamos los pedidos históricos como inexistentes para la UI: solo
		// alimentan estadísticas agregadas, no son navegables por URL directa.
		if (!order || order.historical) throw new Error("Pedido no encontrado");

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
		// Los pedidos históricos solo alimentan estadísticas; no se listan.
		const where: Record<string, unknown> = { ...ONLY_LIVE };
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
		ensureOnChainId(order, "orderId", "Pedido");

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
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
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
		ensureOnChainId(order, "orderId", "Pedido");

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
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
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
		ensureOnChainId(order, "orderId", "Pedido");

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
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al solicitar devolución: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ── Pedidos agrupados (batches) ──────────────────────────────────────────

/**
 * Lista los pedidos agrupados (batches) del usuario logueado.
 * Cada batch contiene N artículos de una sola compra.
 * Acceso: estudiantes y profesores.
 */
export async function listMyBatches(
	limit = 20,
	offset = 0,
	generalStatus?: string,
) {
	const safeLimit = Math.min(Math.max(limit, 1), 100);
	const safeOffset = Math.max(offset, 0);

	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR"]);

	const computeStatus = (statuses: string[]) => {
		if (statuses.every((s) => s === "RETURNED")) return "RETURNED";
		if (statuses.some((s) => s === "RETURNED")) return "PARTIALLY_RETURNED";
		if (statuses.every((s) => s === "DELIVERED")) return "DELIVERED";
		if (statuses.some((s) => s === "DELIVERED")) return "PARTIALLY_DELIVERED";
		return "PAID";
	};

	try {
		// `generalStatus` es derivado: cuando se filtra, traemos todos los
		// batches del usuario, calculamos estado, filtramos y paginamos en
		// memoria (volúmenes razonables por usuario).
		if (generalStatus) {
			const allBatches = await prisma.orderBatch.findMany({
				where: { ...ONLY_LIVE, userId: session.userId },
				include: {
					items: {
						include: {
							product: {
								select: { name: true, imageUrl: true, category: true, color: true, variantLabel: true },
							},
						},
						orderBy: { purchaseDate: "asc" },
					},
				},
				orderBy: { purchaseDate: "desc" },
			});
			const withStatus = allBatches.map((batch) => ({
				...batch,
				generalStatus: computeStatus(batch.items.map((i) => i.status)),
			}));
			const filtered = withStatus.filter((b) => b.generalStatus === generalStatus);
			return {
				batches: filtered.slice(safeOffset, safeOffset + safeLimit),
				total: filtered.length,
			};
		}

		const [batches, total] = await Promise.all([
			prisma.orderBatch.findMany({
				where: { ...ONLY_LIVE, userId: session.userId },
				include: {
					items: {
						include: {
							product: {
								select: { name: true, imageUrl: true, category: true, color: true, variantLabel: true },
							},
						},
						orderBy: { purchaseDate: "asc" },
					},
				},
				orderBy: { purchaseDate: "desc" },
				take: safeLimit,
				skip: safeOffset,
			}),
			prisma.orderBatch.count({ where: { ...ONLY_LIVE, userId: session.userId } }),
		]);

		const batchesWithStatus = batches.map((batch) => ({
			...batch,
			generalStatus: computeStatus(batch.items.map((i) => i.status)),
		}));

		return { batches: batchesWithStatus, total };
	} catch (error) {
		throw new Error(`Error al listar pedidos: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Obtiene el detalle de un pedido agrupado (batch) por su ID de Prisma.
 * Incluye todos los artículos con su producto y estado individual.
 * Acceso: propietario o admin.
 */
export async function getBatchDetail(batchPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["STUDENT", "PROFESSOR", "ADMIN"]);

	try {
		const batch = await prisma.orderBatch.findUnique({
			where: { id: batchPrismaId },
			include: {
				user: { select: { name: true, email: true } },
				items: {
					include: {
						product: {
							select: { name: true, imageUrl: true, category: true, color: true, variantLabel: true, price: true },
						},
					},
					orderBy: { purchaseDate: "asc" },
				},
			},
		});

		// Tratamos los batches históricos como inexistentes para la UI: solo
		// alimentan estadísticas agregadas, no son navegables por URL directa.
		if (!batch || batch.historical) throw new Error("Pedido no encontrado");

		// Solo el propietario o admin pueden ver el detalle
		if (session.role !== "ADMIN" && batch.userId !== session.userId) {
			throw new Error("No autorizado");
		}

		// Estado general
		const statuses = batch.items.map((i) => i.status);
		let generalStatus: string;

		if (statuses.every((s) => s === "RETURNED")) {
			generalStatus = "RETURNED";
		} else if (statuses.some((s) => s === "RETURNED")) {
			generalStatus = "PARTIALLY_RETURNED";
		} else if (statuses.every((s) => s === "DELIVERED")) {
			generalStatus = "DELIVERED";
		} else if (statuses.some((s) => s === "DELIVERED")) {
			generalStatus = "PARTIALLY_DELIVERED";
		} else {
			generalStatus = "PAID";
		}

		return { ...batch, generalStatus };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Pedido no encontrado")) throw error;
		throw new Error(`Error al obtener detalle del pedido: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Lista todos los pedidos agrupados (batches) para el admin.
 * Soporta filtro por userId y paginación.
 * Acceso: solo admin.
 */
export async function listAllBatches(
	limit = 20,
	offset = 0,
	userId?: string,
	generalStatus?: string,
) {
	const safeLimit = Math.min(Math.max(limit, 1), 200);
	const safeOffset = Math.max(offset, 0);

	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		// Históricos solo alimentan estadísticas, no aparecen en el panel admin.
		const where: Record<string, unknown> = { ...ONLY_LIVE };
		if (userId) where.userId = userId;

		// `generalStatus` es un campo derivado de los items: no se puede filtrar
		// en el `where` de Prisma. Cuando hay filtro derivado, traemos todos los
		// batches que cumplan los filtros directos, computamos el estado global
		// y paginamos en memoria — así `total` y `items` quedan consistentes con
		// el filtro visible.
		const computeStatus = (statuses: string[]) => {
			if (statuses.every((s) => s === "RETURNED")) return "RETURNED";
			if (statuses.some((s) => s === "RETURNED")) return "PARTIALLY_RETURNED";
			if (statuses.every((s) => s === "DELIVERED")) return "DELIVERED";
			if (statuses.some((s) => s === "DELIVERED")) return "PARTIALLY_DELIVERED";
			return "PAID";
		};

		if (generalStatus) {
			const allBatches = await prisma.orderBatch.findMany({
				where,
				include: {
					user: { select: { name: true, email: true } },
					items: {
						include: {
							product: {
								select: { name: true, imageUrl: true, category: true },
							},
						},
						orderBy: { purchaseDate: "asc" },
					},
				},
				orderBy: { purchaseDate: "desc" },
			});

			const withStatus = allBatches.map((batch) => ({
				...batch,
				generalStatus: computeStatus(batch.items.map((i) => i.status)),
			}));
			const filtered = withStatus.filter((b) => b.generalStatus === generalStatus);
			const page = filtered.slice(safeOffset, safeOffset + safeLimit);
			return { batches: page, total: filtered.length };
		}

		const [batches, total] = await Promise.all([
			prisma.orderBatch.findMany({
				where,
				include: {
					user: { select: { name: true, email: true } },
					items: {
						include: {
							product: {
								select: { name: true, imageUrl: true, category: true },
							},
						},
						orderBy: { purchaseDate: "asc" },
					},
				},
				orderBy: { purchaseDate: "desc" },
				take: safeLimit,
				skip: safeOffset,
			}),
			prisma.orderBatch.count({ where }),
		]);

		const batchesWithStatus = batches.map((batch) => ({
			...batch,
			generalStatus: computeStatus(batch.items.map((i) => i.status)),
		}));

		return { batches: batchesWithStatus, total };
	} catch (error) {
		throw new Error(`Error al listar pedidos (admin): ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

/**
 * Marca todos los artículos de un batch como entregados.
 * Acceso: solo admin.
 */
export async function markBatchDelivered(batchPrismaId: string) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	try {
		const batch = await prisma.orderBatch.findUnique({
			where: { id: batchPrismaId },
			include: { items: true },
		});
		if (!batch) throw new Error("Pedido no encontrado");

		const paidItems = batch.items.filter((i) => i.status === "PAID" && !i.historical);
		if (paidItems.length === 0) {
			throw new Error("No hay artículos pendientes de entrega en este pedido");
		}

		// Marcar cada artículo como entregado on-chain
		for (const item of paidItems) {
			ensureOnChainId(item, "orderId", "Pedido");
			const hash = await adminWalletClient.writeContract({
				address: CONTRACT_ADDRESSES.campusShop as `0x${string}`,
				abi: CAMPUS_SHOP_ABI,
				functionName: "markDelivered",
				args: [BigInt(item.orderId)],
			});
			await publicClient.waitForTransactionReceipt({ hash });
		}

		// Actualizar en Prisma
		await prisma.order.updateMany({
			where: {
				...ONLY_LIVE,
				id: { in: paidItems.map((i) => i.id) },
			},
			data: {
				status: "DELIVERED",
				deliveryDate: new Date(),
			},
		});

		return { success: true, deliveredCount: paidItems.length };
	} catch (error) {
		if (error instanceof Error && (error.message === "No autorizado" || error.message === "Pedido no encontrado")) throw error;
		if (isContractPauseError(error)) throw translateContractError(error, "Tienda");
		throw new Error(`Error al marcar como entregado: ${error instanceof Error ? error.message : "desconocido"}`);
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
			allUsers,
		] = await Promise.all([
			prisma.product.count(),
			prisma.product.count({ where: { active: true } }),
			prisma.order.count(),
			prisma.order.groupBy({
				by: ["status"],
				_count: { id: true },
			}),
			prisma.user.findMany({ select: { address: true } }),
		]);

		const statusCounts = {
			PAID: 0,
			DELIVERED: 0,
			RETURNED: 0,
		};
		for (const group of ordersByStatus) {
			statusCounts[group.status] = group._count.id;
		}

		// Calcular tokens en circulación sumando balances on-chain
		let tokensInCirculation = 0;
		try {
			const balances = await Promise.all(
				allUsers
					.filter((u) => u.address)
					.map((u) => readShopBalance(u.address).catch(() => BigInt(0))),
			);
			tokensInCirculation = balances.reduce((sum, b) => sum + Number(b), 0);
		} catch {
			// Si falla la lectura on-chain, dejamos 0
		}

		return {
			totalProducts,
			activeProducts,
			totalOrders,
			tokensInCirculation,
			...statusCounts,
		};
	} catch (error) {
		throw new Error(`Error al obtener estadísticas: ${error instanceof Error ? error.message : "desconocido"}`);
	}
}

// ════════════════════════════════════════════════════
// TRANSACCIONES (log unificado de compras + recargas)
// ════════════════════════════════════════════════════

/**
 * Devuelve un log unificado de transacciones: compras (gasto) + recargas,
 * devoluciones y recompensas por uso de la aplicación (ingresos).
 * Solo admin. Paginado, filtrable por userId.
 */
export async function listAllTransactions(
	limit = 10,
	offset = 0,
	userId?: string,
	typeFilter?: "purchase" | "topup" | "refund" | "reward",
	directionFilter?: "income" | "expense",
) {
	const session = await getSession();
	ensureRole(session, ["ADMIN"]);

	const safeLimit = Math.min(Math.max(limit, 1), 100);
	const safeOffset = Math.max(offset, 0);

	const userWhere = userId ? { userId } : {};

	// El log de transacciones representa movimientos on-chain reales de
	// ShopTokens; los pedidos históricos no movieron tokens, así que se
	// excluyen aquí (siguen contando en estadísticas agregadas).
	const [orders, topups, rewards] = await Promise.all([
		prisma.order.findMany({
			where: { ...userWhere, ...ONLY_LIVE },
			include: {
				user: { select: { name: true, email: true } },
				product: { select: { name: true } },
			},
			orderBy: { purchaseDate: "desc" },
		}),
		prisma.cardTopupSimulation.findMany({
			where: { ...userWhere, status: "SUCCESS" },
			include: {
				user: { select: { name: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.shopTokenReward.findMany({
			where: userWhere,
			include: {
				user: { select: { name: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
	]);

	// Unificar en un formato común
	type TransactionEntry = {
		id: string;
		type: "purchase" | "topup" | "refund" | "reward";
		direction: "income" | "expense";
		date: Date;
		userName: string;
		userEmail: string;
		amount: number;
		description: string;
		txHash: string | null;
	};

	const unified: TransactionEntry[] = [];

	// Compras (gasto)
	for (const order of orders) {
		unified.push({
			id: `purchase-${order.id}`,
			type: "purchase",
			direction: "expense",
			date: order.purchaseDate,
			userName: order.user.name,
			userEmail: order.user.email,
			amount: -(order.pricePaid * order.quantity),
			description: `Compra: ${order.product.name}`,
			txHash: order.txHash,
		});

		// Devoluciones (ingreso) — solo si el order fue devuelto
		if (order.status === "RETURNED" && order.returnDate) {
			unified.push({
				id: `refund-${order.id}`,
				type: "refund",
				direction: "income",
				date: order.returnDate,
				userName: order.user.name,
				userEmail: order.user.email,
				amount: order.pricePaid * order.quantity,
				description: `Devolución: ${order.product.name}`,
				txHash: order.txHash,
			});
		}
	}

	// Recargas (ingreso)
	for (const topup of topups) {
		unified.push({
			id: `topup-${topup.id}`,
			type: "topup",
			direction: "income",
			date: topup.createdAt,
			userName: topup.user.name,
			userEmail: topup.user.email,
			amount: topup.amount,
			description: `Recarga: +${topup.amount} ShopTokens`,
			txHash: topup.txHash,
		});
	}

	// Recompensas por uso de la app (ingreso)
	for (const reward of rewards) {
		const label = REWARD_DESCRIPTIONS[reward.reason] ?? reward.reason;
		unified.push({
			id: `reward-${reward.id}`,
			type: "reward",
			direction: "income",
			date: reward.createdAt,
			userName: reward.user.name,
			userEmail: reward.user.email,
			amount: reward.amount,
			description: `Recompensa: ${label}`,
			txHash: reward.txHash,
		});
	}

	// Filtrar por tipo
	let filtered = unified;
	if (typeFilter) {
		filtered = filtered.filter((t) => t.type === typeFilter);
	}
	// Filtrar por dirección
	if (directionFilter) {
		filtered = filtered.filter((t) => t.direction === directionFilter);
	}

	// Ordenar por fecha descendente y paginar
	filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
	const total = filtered.length;
	const paged = filtered.slice(safeOffset, safeOffset + safeLimit);

	return {
		transactions: paged,
		total,
		limit: safeLimit,
		offset: safeOffset,
	};
}
