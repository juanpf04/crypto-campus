/**
 * system-modules-status.ts — Lectura cacheada del estado paused() de los módulos.
 *
 * Usado por <ModuleGuard> en server components (layouts). Cachea con revalidate
 * de 5s para no machacar el RPC en cada navegación.
 *
 * NO requiere admin: lectura de `paused()` es una view function pública.
 */

import { unstable_cache } from "next/cache";
import { publicClient } from "@/lib/viem";
import {
  CONTRACT_META,
  MODULES,
  deriveModuleStatus,
  type ContractKey,
  type ModuleId,
  type ModuleStatus,
} from "@/lib/system-modules";

/**
 * Devuelve el estado de un módulo: "active" | "paused" | "partial".
 * Cacheado durante 5s. La función subyacente lee `paused()` de cada contrato
 * del módulo en paralelo y deriva el estado lógico.
 */
export const getCachedModuleStatus = unstable_cache(
  async (moduleId: ModuleId): Promise<ModuleStatus> => {
    const mod = MODULES.find((m) => m.id === moduleId);
    if (!mod) throw new Error(`Módulo desconocido: ${moduleId}`);

    try {
      const flags = await Promise.all(
        mod.contracts.map((key: ContractKey) =>
          publicClient.readContract({
            address: CONTRACT_META[key].address,
            abi: CONTRACT_META[key].abi,
            functionName: "paused",
          }) as Promise<boolean>,
        ),
      );
      return deriveModuleStatus(flags);
    } catch (err) {
      // Si el nodo no responde no podemos saber el estado real. Devolvemos
      // "active" para no bloquear al usuario gratuitamente — la propia
      // operación on-chain fallará si la cadena está caída, y la capa B
      // (translateContractError) mostrará un error legible.
      console.error("[getCachedModuleStatus] no se pudo leer paused()", err);
      return "active";
    }
  },
  ["module-status"],
  { revalidate: 5, tags: ["module-status"] },
);
