/**
 * shopRewardsMeta.ts — Tipos y metadatos de recompensas compartidos entre
 * servidor y cliente.
 *
 * Este módulo NO importa nada de servidor (prisma, viem) para poder ser usado
 * desde componentes cliente sin contaminar el bundle del navegador con código
 * que sólo debe correr en Node.
 *
 * - `shopRewards.ts` añade la lógica de minteo (servidor).
 * - `rewardToast.ts` usa `REWARD_DESCRIPTIONS` para formatear toasts (cliente).
 */

import { ShopTokenRewardReason } from "@prisma/client";

export { ShopTokenRewardReason };

export type RewardGrant = {
	amount: number;
	reason: ShopTokenRewardReason;
};

/** Descripciones legibles por reason para UI (admin log + toasts). */
export const REWARD_DESCRIPTIONS: Record<ShopTokenRewardReason, string> = {
	LOAN_RETURNED_ON_TIME:     "Devolución de préstamo a tiempo",
	LOAN_RETURNED_EARLY:       "Devolución anticipada de préstamo",
	ROOM_BOOKED:               "Reserva de sala",
	PRINT_JOB:                 "Trabajo de impresión",
	BADGE_AWARDED:             "Insignia académica recibida",
	MODULE_FIRST_USE_LIBRARY:  "Bonus primer uso: Biblioteca",
	MODULE_FIRST_USE_ROOMS:    "Bonus primer uso: Salas",
	MODULE_FIRST_USE_PRINTING: "Bonus primer uso: Impresión",
	MODULE_FIRST_USE_BADGES:   "Bonus primer uso: Insignias",
	MODULE_FIRST_USE_SHOP:     "Bonus primer uso: Tienda",
};

/** Cantidades fijas de SHPT por reason. */
export const REWARD_AMOUNTS = {
	LOAN_RETURNED_ON_TIME:     2,
	LOAN_RETURNED_EARLY:       3,
	ROOM_BOOKED:               1,
	BADGE_AWARDED:             5,
	MODULE_FIRST_USE_LIBRARY:  2,
	MODULE_FIRST_USE_ROOMS:    2,
	MODULE_FIRST_USE_PRINTING: 2,
	MODULE_FIRST_USE_BADGES:   2,
	MODULE_FIRST_USE_SHOP:     2,
} as const satisfies Partial<Record<ShopTokenRewardReason, number>>;
