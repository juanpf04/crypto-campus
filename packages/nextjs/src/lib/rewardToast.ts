/**
 * rewardToast — Helper cliente para mostrar recompensas de ShopTokens
 * devueltas por los server actions como toasts de éxito.
 *
 * Server actions como checkoutCart, bookRoom, requestLoan, executeMyPrintJob
 * y redeemReward devuelven un campo `rewards: RewardGrant[]`. Este helper lo
 * convierte en llamadas a addToast con mensajes legibles.
 */

import { REWARD_DESCRIPTIONS, type RewardGrant } from "@/lib/shopRewardsMeta";

type AddToast = (message: string, variant?: "success" | "danger" | "warning" | "info") => void;

/** Fires one success toast per reward in the list. No-op si la lista es vacía. */
export function toastRewards(addToast: AddToast, rewards: RewardGrant[] | undefined): void {
  if (!rewards || rewards.length === 0) return;
  for (const r of rewards) {
    const label = REWARD_DESCRIPTIONS[r.reason] ?? r.reason;
    addToast(`+${r.amount} SHPT · ${label}`, "success");
  }
}
