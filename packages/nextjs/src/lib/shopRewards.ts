/**
 * shopRewards.ts — Helper SERVIDOR para mintear ShopTokens como recompensa.
 *
 * Flujo: valida si hay recompensa de primer uso pendiente → llama a ShopToken.mint()
 * con el adminWalletClient → persiste el registro en ShopTokenReward.
 *
 * Tipos/constantes compartidos con cliente viven en `shopRewardsMeta.ts` para
 * evitar arrastrar prisma/viem al bundle del navegador.
 */

import { prisma } from "@/lib/prisma";
import { adminWalletClient } from "@/lib/viem";
import { CONTRACT_ADDRESSES, SHOP_TOKEN_ABI } from "@/lib/contracts";
import {
	ShopTokenRewardReason,
	REWARD_AMOUNTS,
	type RewardGrant,
} from "@/lib/shopRewardsMeta";

// Re-exports de conveniencia para call sites que antes importaban de aquí.
export { ShopTokenRewardReason, REWARD_AMOUNTS, REWARD_DESCRIPTIONS } from "@/lib/shopRewardsMeta";
export type { RewardGrant } from "@/lib/shopRewardsMeta";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve true si el usuario ya tiene al menos una reward con ese reason. */
export async function hasRewardOfType(
	userId: string,
	reason: ShopTokenRewardReason,
): Promise<boolean> {
	const existing = await prisma.shopTokenReward.findFirst({
		where: { userId, reason },
		select: { id: true },
	});
	return existing !== null;
}

/** Devuelve true si el usuario tiene una reward de ese reason creada en o después de `since`. */
export async function hasRewardOfTypeSince(
	userId: string,
	reason: ShopTokenRewardReason,
	since: Date,
): Promise<boolean> {
	const existing = await prisma.shopTokenReward.findFirst({
		where: { userId, reason, createdAt: { gte: since } },
		select: { id: true },
	});
	return existing !== null;
}

/** Medianoche UTC del día actual — usado como ventana "hoy" en throttles diarios. */
function startOfTodayUTC(): Date {
	const d = new Date();
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

/**
 * Mintea `amount` ShopTokens a la wallet del usuario y registra la recompensa.
 * Devuelve la entrada minteada, o null si amount ≤ 0 (no-op).
 */
export async function mintShopReward(
	userId: string,
	userAddress: string,
	amount: number,
	reason: ShopTokenRewardReason,
): Promise<RewardGrant | null> {
	if (amount <= 0) return null;

	const txHash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.shopToken,
		abi: SHOP_TOKEN_ABI,
		functionName: "mint",
		args: [userAddress as `0x${string}`, BigInt(amount)],
	});

	await prisma.shopTokenReward.create({
		data: { userId, amount, reason, txHash },
	});

	return { amount, reason };
}

// ── Función principal ────────────────────────────────────────────────────────

/**
 * Emite las recompensas correspondientes a una acción del usuario.
 * Gestiona automáticamente el bonus de primer uso de cada módulo.
 *
 * **Failsafe**: las recompensas son secundarias a la operación principal del
 * usuario (préstamo, compra, impresión...). Si fallan (ej. ShopToken pausado
 * porque admin pausó el módulo Tienda mientras el usuario operaba), no deben
 * tumbar la acción ya completada. Devolvemos `[]` y loggeamos el error.
 *
 * @param userId            ID de usuario en Prisma
 * @param userAddress       Dirección wallet del usuario
 * @param mainReason        Motivo principal de la recompensa
 * @param mainAmount        Cantidad de SHPT a mintear (usa REWARD_AMOUNTS si no se pasa)
 * @param firstUseReason    Reason de primer uso asociado al módulo (opcional)
 * @param mainOncePerDay    Si true, NO mintea la recompensa principal si el
 *                          usuario ya recibió una con ese reason hoy (UTC).
 *                          Usado para evitar abuso por bucle reservar/cancelar
 *                          en `ROOM_BOOKED`. El bonus firstUse no se ve afectado.
 */
export async function issueReward(params: {
	userId: string;
	userAddress: string;
	mainReason: ShopTokenRewardReason;
	mainAmount?: number;
	firstUseReason?: ShopTokenRewardReason;
	mainOncePerDay?: boolean;
}): Promise<RewardGrant[]> {
	const { userId, userAddress, mainReason, firstUseReason, mainOncePerDay } = params;
	const mainAmount =
		params.mainAmount ?? (REWARD_AMOUNTS as Record<string, number>)[mainReason] ?? 0;

	const granted: RewardGrant[] = [];

	// Recompensa principal — con throttle diario si mainOncePerDay está activo.
	try {
		const skip = mainOncePerDay
			? await hasRewardOfTypeSince(userId, mainReason, startOfTodayUTC())
			: false;
		if (!skip) {
			const main = await mintShopReward(userId, userAddress, mainAmount, mainReason);
			if (main) granted.push(main);
		}
	} catch (error) {
		console.error(
			`[issueReward] No se pudo mintear recompensa principal (${mainReason}) para ${userId}:`,
			error instanceof Error ? error.message : error,
		);
	}

	// Bonus de primer uso (si aplica y no se ha dado antes)
	if (firstUseReason) {
		try {
			const alreadyHad = await hasRewardOfType(userId, firstUseReason);
			if (!alreadyHad) {
				const bonusAmount =
					(REWARD_AMOUNTS as Record<string, number>)[firstUseReason] ?? 2;
				const bonus = await mintShopReward(userId, userAddress, bonusAmount, firstUseReason);
				if (bonus) granted.push(bonus);
			}
		} catch (error) {
			console.error(
				`[issueReward] No se pudo mintear bonus primer uso (${firstUseReason}) para ${userId}:`,
				error instanceof Error ? error.message : error,
			);
		}
	}

	return granted;
}
