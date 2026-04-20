/**
 * shopRewards.ts — Helper para mintear ShopTokens como recompensa por actividad.
 *
 * Flujo: valida si hay recompensa de primer uso pendiente → llama a ShopToken.mint()
 * con el adminWalletClient → persiste el registro en ShopTokenReward.
 */

import { ShopTokenRewardReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminWalletClient } from "@/lib/viem";
import { CONTRACT_ADDRESSES, SHOP_TOKEN_ABI } from "@/lib/contracts";

export { ShopTokenRewardReason };

// ── Cantidades fijas ─────────────────────────────────────────────────────────

export const REWARD_AMOUNTS = {
	LOAN_RETURNED_ON_TIME:    2,
	LOAN_RETURNED_EARLY:      3,
	ROOM_BOOKED:              1,
	BADGE_AWARDED:            5,
	MODULE_FIRST_USE_LIBRARY:  2,
	MODULE_FIRST_USE_ROOMS:    2,
	MODULE_FIRST_USE_PRINTING: 2,
	MODULE_FIRST_USE_BADGES:   2,
} as const satisfies Partial<Record<ShopTokenRewardReason, number>>;

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

/**
 * Mintea `amount` ShopTokens a la wallet del usuario y registra la recompensa.
 * Si amount ≤ 0, no hace nada.
 */
export async function mintShopReward(
	userId: string,
	userAddress: string,
	amount: number,
	reason: ShopTokenRewardReason,
): Promise<void> {
	if (amount <= 0) return;

	const txHash = await adminWalletClient.writeContract({
		address: CONTRACT_ADDRESSES.shopToken,
		abi: SHOP_TOKEN_ABI,
		functionName: "mint",
		args: [userAddress as `0x${string}`, BigInt(amount)],
	});

	await prisma.shopTokenReward.create({
		data: { userId, amount, reason, txHash },
	});
}

// ── Función principal ────────────────────────────────────────────────────────

/**
 * Emite las recompensas correspondientes a una acción del usuario.
 * Gestiona automáticamente el bonus de primer uso de cada módulo.
 *
 * @param userId       ID de usuario en Prisma
 * @param userAddress  Dirección wallet del usuario
 * @param mainReason   Motivo principal de la recompensa
 * @param mainAmount   Cantidad de SHPT a mintear (usa REWARD_AMOUNTS si no se pasa)
 * @param firstUseReason  Reason de primer uso asociado al módulo (opcional)
 */
export async function issueReward(params: {
	userId: string;
	userAddress: string;
	mainReason: ShopTokenRewardReason;
	mainAmount?: number;
	firstUseReason?: ShopTokenRewardReason;
}): Promise<void> {
	const { userId, userAddress, mainReason, firstUseReason } = params;
	const mainAmount =
		params.mainAmount ?? (REWARD_AMOUNTS as Record<string, number>)[mainReason] ?? 0;

	// Recompensa principal
	await mintShopReward(userId, userAddress, mainAmount, mainReason);

	// Bonus de primer uso (si aplica y no se ha dado antes)
	if (firstUseReason) {
		const alreadyHad = await hasRewardOfType(userId, firstUseReason);
		if (!alreadyHad) {
			const bonusAmount =
				(REWARD_AMOUNTS as Record<string, number>)[firstUseReason] ?? 2;
			await mintShopReward(userId, userAddress, bonusAmount, firstUseReason);
		}
	}
}
