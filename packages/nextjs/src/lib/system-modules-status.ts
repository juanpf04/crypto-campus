/**
 * system-modules-status.ts — Lectura del estado paused() de los módulos.
 *
 * Usado por <ModuleGuard> en server components (layouts). Lee directamente
 * on-chain en cada render para reflejar el estado real al instante (sin
 * ventana de inconsistencia tras pause/unpause).
 *
 * El coste es ~1 RPC request por contrato del módulo (1-2 contratos por
 * módulo), totalmente asumible para un layout server-side. Envolvemos la
 * función con `React.cache` para deduplicar lecturas dentro del MISMO
 * request (p. ej. una página hub multi-módulo que consulta library, rooms
 * y print no repite RPC si dos componentes piden el mismo módulo).
 *
 * NO requiere admin: lectura de `paused()` es una view function pública.
 */

import { cache } from "react";
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
 * Lee `paused()` de cada contrato del módulo en paralelo y deriva el estado.
 * Deduplicado por request mediante React.cache.
 */
export const getModuleStatus = cache(
  async (moduleId: ModuleId): Promise<ModuleStatus> => {
    const mod = MODULES.find((m) => m.id === moduleId);
    if (!mod) throw new Error(`Módulo desconocido: ${moduleId}`);

    const readFlags = () =>
      Promise.all(
        mod.contracts.map((key: ContractKey) =>
          publicClient.readContract({
            address: CONTRACT_META[key].address,
            abi: CONTRACT_META[key].abi,
            functionName: "paused",
          }) as Promise<boolean>,
        ),
      );

    try {
      const first = deriveModuleStatus(await readFlags());
      // Si la primera lectura dice "active", es definitiva y devolvemos sin más.
      // Si dice "paused" o "partial", reintentamos UNA vez para descartar un
      // estado transitorio del nodo justo después de una transacción reciente
      // — sin esto el usuario veía a veces ModulePausedScreen tras una tx
      // exitosa pese a no haber ninguna pausa real.
      if (first === "active") return first;
      return deriveModuleStatus(await readFlags());
    } catch (err) {
      // Si el nodo no responde no podemos saber el estado real. Devolvemos
      // "active" para no bloquear al usuario gratuitamente — la propia
      // operación on-chain fallará si la cadena está caída, y la capa B
      // (translateContractError) mostrará un error legible.
      console.error("[getModuleStatus] no se pudo leer paused()", err);
      return "active";
    }
  },
);
