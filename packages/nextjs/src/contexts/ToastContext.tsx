"use client";

/**
 * ToastContext.tsx — Sistema global de notificaciones flotantes (toasts).
 *
 * Modelo de cola:
 *   - Hay como mucho MAX_VISIBLE (3) toasts en pantalla a la vez.
 *   - Si llegan más, se encolan y aparecen cuando hay hueco.
 *   - Entre dos apariciones consecutivas se respeta un gap mínimo de
 *     MIN_GAP_MS (1s) para que no se "amontonen" cuando se disparan
 *     muchas notificaciones en rápida sucesión.
 *
 * Estructura interna:
 *   - `queue`   → toasts pendientes de aparecer (cola FIFO).
 *   - `visible` → toasts actualmente en pantalla.
 *
 * La API pública sigue siendo { toasts, addToast, removeToast } — los
 * llamadores no se enteran del split: leen `toasts` y reciben los visibles.
 *
 * Auto-dismiss:
 *   El propio componente <Toast/> tiene su useEffect que llama a onClose
 *   tras `duration`. Cuando dispara, removeToast(id) filtra de visible y el
 *   effect de promoción detecta el hueco y mueve el siguiente de la cola.
 */

import {
  createContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";

/** Variantes visuales — cada una mapea a un color del tema CSS */
export type ToastVariant = "success" | "danger" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

/** Máximo de toasts visibles a la vez */
const MAX_VISIBLE = 3;

/** Gap mínimo (ms) entre dos apariciones consecutivas */
const MIN_GAP_MS = 1000;

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const [visible, setVisible] = useState<Toast[]>([]);

  /** Timestamp (ms) de la última promoción cola → visible */
  const lastShownAtRef = useRef<number>(0);
  /** Timer en curso de promoción, si lo hay */
  const promotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Espejo de queue para inspeccionar al disparar el timer (evita closures stale) */
  const queueRef = useRef<Toast[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const removeToast = useCallback((id: string) => {
    setVisible((prev) => prev.filter((t) => t.id !== id));
    setQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = crypto.randomUUID();
      setQueue((prev) => [...prev, { id, message, variant }]);
    },
    [],
  );

  // Effect de promoción: cada vez que cambia queue o visible, evalúa si
  // hay hueco para mover el primero de la cola a la zona visible.
  useEffect(() => {
    if (queue.length === 0) return;
    if (visible.length >= MAX_VISIBLE) return;
    if (promotionTimerRef.current !== null) return;

    const elapsed = Date.now() - lastShownAtRef.current;
    const wait = Math.max(0, MIN_GAP_MS - elapsed);
    const candidateId = queue[0].id;

    promotionTimerRef.current = setTimeout(() => {
      promotionTimerRef.current = null;
      // El candidato podría haber sido removido entre el schedule y el fire
      // (p.ej. si el caller llamó removeToast). Comprobamos contra el ref.
      const item = queueRef.current.find((t) => t.id === candidateId);
      if (!item) return;
      lastShownAtRef.current = Date.now();
      setQueue((prev) => prev.filter((t) => t.id !== candidateId));
      setVisible((prev) => [...prev, item]);
    }, wait);

    return () => {
      if (promotionTimerRef.current !== null) {
        clearTimeout(promotionTimerRef.current);
        promotionTimerRef.current = null;
      }
    };
  }, [queue, visible.length]);

  return (
    <ToastContext.Provider value={{ toasts: visible, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}
