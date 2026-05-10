"use server";

/**
 * system.ts — Server actions del panel de "Estado del sistema" (admin).
 *
 * Permite al admin leer el estado paused() de los 8 contratos y pausar /
 * despausar tanto módulos individuales como el sistema entero.
 *
 * Patrón de tx (consistente con resto del repo):
 *   adminWalletClient.writeContract → waitForTransactionReceipt → check status === "success".
 *
 * Idempotencia: antes de pausar/despausar un contrato leemos su estado actual
 * y saltamos si ya está en el estado deseado. Eso permite reintentar tras
 * una pausa parcial sin riesgo de revertir.
 */

import { getSession, ensureAdmin } from "@/lib/auth";
import { adminWalletClient, publicClient } from "@/lib/viem";
import {
  CONTRACT_META,
  MODULES,
  deriveModuleStatus,
  getModule,
  type ContractKey,
  type ModuleId,
  type ModuleStatus,
} from "@/lib/system-modules";

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface ContractActionResult {
  contractKey: ContractKey;
  ok: boolean;
  /** "skipped" si ya estaba en el estado destino, "executed" si se mandó tx, "failed" si revirtió. */
  outcome: "skipped" | "executed" | "failed";
  txHash?: string;
  error?: string;
}

export interface ModuleActionResult {
  moduleId: ModuleId;
  ok: boolean;
  results: ContractActionResult[];
}

export interface ContractStatus {
  paused: boolean;
}

export interface ModuleStatusInfo {
  id: ModuleId;
  name: string;
  description: string;
  status: ModuleStatus;
  contracts: { key: ContractKey; label: string; paused: boolean }[];
  warning?: string;
  iconKey: string;
}

export interface SystemStatus {
  nodeOnline: boolean;
  contracts: Record<ContractKey, ContractStatus>;
  modules: ModuleStatusInfo[];
}

// ─── Helpers internos ─────────────────────────────────────────────────────

/** Lee el estado paused() de un contrato. Lanza si la lectura falla. */
async function readPaused(contractKey: ContractKey): Promise<boolean> {
  const meta = CONTRACT_META[contractKey];
  const result = await publicClient.readContract({
    address: meta.address,
    abi: meta.abi,
    functionName: "paused",
  });
  return Boolean(result);
}

/**
 * Ejecuta pause() o unpause() en un contrato. Idempotente: si ya está en el
 * estado destino, devuelve "skipped" sin enviar tx.
 */
async function setContractPaused(
  contractKey: ContractKey,
  shouldPause: boolean,
): Promise<ContractActionResult> {
  try {
    const currentlyPaused = await readPaused(contractKey);
    if (currentlyPaused === shouldPause) {
      return { contractKey, ok: true, outcome: "skipped" };
    }

    const meta = CONTRACT_META[contractKey];
    const hash = await adminWalletClient.writeContract({
      address: meta.address,
      abi: meta.abi,
      functionName: shouldPause ? "pause" : "unpause",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== "success") {
      return {
        contractKey,
        ok: false,
        outcome: "failed",
        txHash: hash,
        error: "Transacción revertida",
      };
    }
    return { contractKey, ok: true, outcome: "executed", txHash: hash };
  } catch (err) {
    return {
      contractKey,
      ok: false,
      outcome: "failed",
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ─── Acciones públicas ────────────────────────────────────────────────────

/**
 * Lee el estado paused() de los 8 contratos en paralelo y deriva el estado
 * por módulo lógico. También detecta si el nodo blockchain responde.
 */
export async function getModulesStatus(): Promise<SystemStatus> {
  ensureAdmin(await getSession());

  // Comprobar primero que el nodo responde. Si no, devolvemos un objeto
  // "estado desconocido" en vez de lanzar — la UI lo muestra como banner.
  try {
    await publicClient.getBlockNumber();
  } catch {
    return {
      nodeOnline: false,
      contracts: Object.fromEntries(
        (Object.keys(CONTRACT_META) as ContractKey[]).map((k) => [k, { paused: false }]),
      ) as Record<ContractKey, ContractStatus>,
      modules: MODULES.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        status: "active" as const,
        contracts: m.contracts.map((c) => ({ key: c, label: CONTRACT_META[c].label, paused: false })),
        warning: m.warning,
        iconKey: m.iconKey,
      })),
    };
  }

  // Lecturas en paralelo de los 8 contratos. Usamos `allSettled` para que el
  // fallo en la lectura de UN contrato no tumbe el panel entero — los que
  // fallen se asumen "no pausados" y se loggea para diagnóstico.
  const contractKeys = Object.keys(CONTRACT_META) as ContractKey[];
  const settled = await Promise.allSettled(contractKeys.map((k) => readPaused(k)));
  const contracts = Object.fromEntries(
    contractKeys.map((k, i) => {
      const result = settled[i];
      if (result.status === "fulfilled") {
        return [k, { paused: result.value }];
      }
      console.error(`[getModulesStatus] no se pudo leer paused() de ${k}:`, result.reason);
      return [k, { paused: false }];
    }),
  ) as Record<ContractKey, ContractStatus>;

  // Derivar estado por módulo.
  const modules: ModuleStatusInfo[] = MODULES.map((m) => {
    const contractStates = m.contracts.map((c) => ({
      key: c,
      label: CONTRACT_META[c].label,
      paused: contracts[c].paused,
    }));
    const status = deriveModuleStatus(contractStates.map((c) => c.paused));
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      status,
      contracts: contractStates,
      warning: m.warning,
      iconKey: m.iconKey,
    };
  });

  return { nodeOnline: true, contracts, modules };
}

/**
 * Pausa o despausa todos los contratos de un módulo, secuencialmente.
 * No revierte parciales: si un contrato falla, sigue con los siguientes
 * y devuelve el detalle por contrato. La idempotencia permite reintentar.
 */
async function setModulePaused(
  moduleId: ModuleId,
  shouldPause: boolean,
): Promise<ModuleActionResult> {
  ensureAdmin(await getSession());
  const mod = getModule(moduleId);

  const results: ContractActionResult[] = [];
  for (const contractKey of mod.contracts) {
    const r = await setContractPaused(contractKey, shouldPause);
    results.push(r);
  }
  return { moduleId, ok: results.every((r) => r.ok), results };
}

export async function pauseModule(moduleId: ModuleId): Promise<ModuleActionResult> {
  return setModulePaused(moduleId, true);
}

export async function unpauseModule(moduleId: ModuleId): Promise<ModuleActionResult> {
  return setModulePaused(moduleId, false);
}

/**
 * Pausa o despausa los 8 contratos del sistema (todos los módulos a la vez).
 * Itera los módulos secuencialmente — más seguro y predecible que paralelizar.
 */
async function setAllPaused(shouldPause: boolean): Promise<{
  ok: boolean;
  modules: ModuleActionResult[];
}> {
  ensureAdmin(await getSession());

  const moduleResults: ModuleActionResult[] = [];
  for (const m of MODULES) {
    const r = await setModulePaused(m.id, shouldPause);
    moduleResults.push(r);
  }
  return { ok: moduleResults.every((m) => m.ok), modules: moduleResults };
}

export async function pauseAllModules() {
  return setAllPaused(true);
}

export async function unpauseAllModules() {
  return setAllPaused(false);
}
