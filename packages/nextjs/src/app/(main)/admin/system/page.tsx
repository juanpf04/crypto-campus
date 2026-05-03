"use client";

/**
 * Panel de "Estado del sistema" del ADMIN.
 *
 * - Lee el estado paused() de los 8 contratos vía /api/admin/system/status.
 * - Permite pausar/despausar cada módulo lógico (con `ConfirmModal`).
 * - Permite pausar/despausar TODO el sistema (con `DangerConfirmModal` que
 *   exige escribir "PAUSAR TODO" como freno explícito).
 * - Muestra un banner si el nodo blockchain no responde.
 *
 * Sin polling automático: carga al montar + botón "Actualizar" + re-fetch
 * tras cualquier mutación.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useToast } from "@/hooks/useToast";
import { icons } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { DangerConfirmModal } from "@/components/shared/DangerConfirmModal";
import { ModuleStatusCard } from "@/components/shared/ModuleStatusCard";
import type { SystemStatus, ModuleActionResult } from "@/actions/system";
import type { ModuleId } from "@/lib/system-modules";

// ── Estado de modal genérico ──────────────────────────────────────────────

type ModalState =
  | { type: "none" }
  | { type: "module"; moduleId: ModuleId; moduleName: string; action: "pause" | "unpause" }
  | { type: "all-pause" }
  | { type: "all-unpause" };

const PAUSE_ALL_PHRASE = "PAUSAR TODO";

// ── Componente ────────────────────────────────────────────────────────────

export default function AdminSystemPage() {
  const { user, loading: authLoading } = useAuthUser();
  const { addToast } = useToast();

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perModuleLoading, setPerModuleLoading] = useState<Partial<Record<ModuleId, boolean>>>({});
  const [allLoading, setAllLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  // ── Carga del estado ────────────────────────────────────────────────────

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/system/status");
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar estado");
      const data: SystemStatus = await res.json();
      setStatus(data);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cargar estado del sistema", "danger");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { loadStatus(true); }, [loadStatus]);

  // ── Helpers de toast tras una acción ────────────────────────────────────

  function summarizeModuleResult(result: ModuleActionResult, action: "pause" | "unpause"): { variant: "success" | "warning" | "danger"; message: string } {
    const executed = result.results.filter((r) => r.outcome === "executed").length;
    const skipped = result.results.filter((r) => r.outcome === "skipped").length;
    const failed = result.results.filter((r) => r.outcome === "failed");

    const verb = action === "pause" ? "pausad" : "despausad";
    if (failed.length > 0) {
      return {
        variant: "danger",
        message: `Falló ${failed.length} contrato(s): ${failed.map((f) => f.contractKey).join(", ")}`,
      };
    }
    if (executed === 0 && skipped > 0) {
      return { variant: "warning", message: `Sin cambios: ya estaba${skipped > 1 ? "n" : ""} en el estado deseado` };
    }
    return {
      variant: "success",
      message: `${executed} contrato(s) ${verb}o(s)${skipped > 0 ? ` · ${skipped} ya lo estaba${skipped > 1 ? "n" : ""}` : ""}`,
    };
  }

  // ── Acciones ────────────────────────────────────────────────────────────

  async function executeModuleAction(moduleId: ModuleId, action: "pause" | "unpause") {
    setPerModuleLoading((prev) => ({ ...prev, [moduleId]: true }));
    try {
      const res = await fetch(`/api/admin/system/modules/${moduleId}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok && res.status !== 207) {
        throw new Error(body.error ?? `Error al ${action === "pause" ? "pausar" : "despausar"} módulo`);
      }
      const { variant, message } = summarizeModuleResult(body as ModuleActionResult, action);
      addToast(message, variant === "warning" ? "info" : variant);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error inesperado", "danger");
    } finally {
      setPerModuleLoading((prev) => ({ ...prev, [moduleId]: false }));
      await loadStatus();
    }
  }

  async function executeAllAction(action: "pause" | "unpause") {
    setAllLoading(true);
    try {
      const res = await fetch(`/api/admin/system/all/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok && res.status !== 207) {
        throw new Error(body.error ?? `Error al ${action === "pause" ? "pausar" : "despausar"} el sistema`);
      }
      // body = { ok, modules: ModuleActionResult[] }
      const failed = (body.modules as ModuleActionResult[]).filter((m) => !m.ok);
      if (failed.length === 0) {
        addToast(action === "pause" ? "Sistema completo pausado" : "Sistema completo despausado", "success");
      } else {
        addToast(`Operación parcial: ${failed.length} módulo(s) con fallos. Revisa el detalle.`, "danger");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error inesperado", "danger");
    } finally {
      setAllLoading(false);
      await loadStatus();
    }
  }

  // ── Handlers de modal ───────────────────────────────────────────────────

  function openModulePauseModal(moduleId: ModuleId, moduleName: string) {
    setModal({ type: "module", moduleId, moduleName, action: "pause" });
  }
  function openModuleUnpauseModal(moduleId: ModuleId, moduleName: string) {
    setModal({ type: "module", moduleId, moduleName, action: "unpause" });
  }
  function closeModal() {
    setModal({ type: "none" });
  }
  async function confirmModalAction() {
    if (modal.type === "module") {
      const { moduleId, action } = modal;
      closeModal();
      await executeModuleAction(moduleId, action);
    } else if (modal.type === "all-pause") {
      closeModal();
      await executeAllAction("pause");
    } else if (modal.type === "all-unpause") {
      closeModal();
      await executeAllAction("unpause");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (authLoading || !user || loading) return <SkeletonPage />;

  const nodeOffline = status && !status.nodeOnline;
  const anyPaused = status?.modules.some((m) => m.status !== "active") ?? false;
  const allPaused = status?.modules.every((m) => m.status === "paused") ?? false;

  return (
    <div className="space-y-8">
      <DashboardGreeting name={user.name} subtitle="Pausa o reanuda módulos del sistema." />

      {/* Banner de nodo offline */}
      {nodeOffline && (
        <Card className="border-danger/50 bg-danger/5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-danger/15 text-danger">
              {icons.alert}
            </div>
            <div className="flex-1">
              <p className="font-medium text-danger">Nodo blockchain no responde</p>
              <p className="text-sm text-text-muted">
                Las acciones de pausa están deshabilitadas. Verifica que Anvil esté corriendo en
                <code className="font-mono mx-1">127.0.0.1:8545</code>.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cabecera con título + botón Actualizar */}
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={icons.alert}>Estado del sistema</SectionTitle>
        <Button variant="ghost" onClick={() => loadStatus()} loading={refreshing} disabled={refreshing}>
          <span className="flex items-center gap-2">{icons.refresh} Actualizar</span>
        </Button>
      </div>

      {/* Card de control global */}
      <Card className="border-warning/50 bg-warning/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
              {icons.alert}
            </div>
            <div>
              <p className="font-medium text-text">Pausa de emergencia</p>
              <p className="text-sm text-text-muted">
                Detiene o reanuda los 8 contratos del sistema a la vez. Acción reservada para
                incidentes graves.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="danger"
              onClick={() => setModal({ type: "all-pause" })}
              disabled={!status || nodeOffline || allLoading || allPaused}
              loading={allLoading}
            >
              <span className="flex items-center gap-2">{icons.pause} Pausar todo</span>
            </Button>
            <Button
              variant="success"
              onClick={() => setModal({ type: "all-unpause" })}
              disabled={!status || nodeOffline || allLoading || !anyPaused}
              loading={allLoading}
            >
              <span className="flex items-center gap-2">{icons.play} Despausar todo</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Grid de módulos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {status?.modules.map((m) => (
          <ModuleStatusCard
            key={m.id}
            module={m}
            loading={perModuleLoading[m.id] === true}
            disabled={!!nodeOffline || allLoading}
            onPause={() => openModulePauseModal(m.id, m.name)}
            onUnpause={() => openModuleUnpauseModal(m.id, m.name)}
          />
        ))}
      </div>

      {/* Modal de confirmación por módulo */}
      {modal.type === "module" && (
        <ConfirmModal
          open
          onClose={closeModal}
          onConfirm={confirmModalAction}
          title={modal.action === "pause" ? `Pausar módulo "${modal.moduleName}"` : `Despausar módulo "${modal.moduleName}"`}
          description={
            modal.action === "pause"
              ? `Los usuarios no podrán usar el módulo "${modal.moduleName}" hasta que lo despauses. ¿Continuar?`
              : `Reanudar el módulo "${modal.moduleName}" — los usuarios volverán a poder usarlo. ¿Continuar?`
          }
          confirmLabel={modal.action === "pause" ? "Pausar" : "Despausar"}
        />
      )}

      {/* Modal "Pausar todo" reforzado — render condicional para que cada apertura sea un mount fresco */}
      {modal.type === "all-pause" && (
        <DangerConfirmModal
          open
          onClose={closeModal}
          onConfirm={confirmModalAction}
          title="Pausar todo el sistema"
          description="Esta acción detiene los 8 contratos del sistema. Ningún usuario podrá realizar préstamos, compras, reservas ni nada que toque la blockchain hasta que despauses. Para confirmar, escribe el texto exacto en el campo de abajo."
          confirmPhrase={PAUSE_ALL_PHRASE}
          confirmLabel="Pausar todo el sistema"
          loading={allLoading}
        />
      )}

      {/* Modal "Despausar todo" simple */}
      {modal.type === "all-unpause" && (
        <ConfirmModal
          open
          onClose={closeModal}
          onConfirm={confirmModalAction}
          title="Despausar todo el sistema"
          description="Reanudar los 8 contratos del sistema. Los usuarios podrán volver a usar todos los módulos. ¿Continuar?"
          confirmLabel="Despausar todo"
          loading={allLoading}
        />
      )}
    </div>
  );
}
