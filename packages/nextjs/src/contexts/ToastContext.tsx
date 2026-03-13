"use client";

/**
 * ToastContext.tsx — Sistema global de notificaciones flotantes (toasts).
 *
 * Flujo completo:
 * 1. <ToastProvider> envuelve toda la app desde providers.tsx, así cualquier
 *    componente hijo puede lanzar toasts sin prop-drilling.
 * 2. Un componente llama a addToast("mensaje", "success") →
 *    - Se genera un ID único con crypto.randomUUID().
 *    - Se añade al array reactivo `toasts` (provoca re-render).
 *    - Se programa un setTimeout de 10s que lo eliminará automáticamente.
 *    - El timer se guarda en timersRef (un Map id→timer) para poder cancelarlo.
 * 3. El componente <ToastContainer> (en ui/) consume este contexto,
 *    lee el array `toasts` y renderiza cada uno en pantalla (abajo-derecha).
 * 4. Si el usuario pulsa la X antes de los 10s → removeToast(id):
 *    - Cancela el timer pendiente con clearTimeout.
 *    - Lo elimina del mapa de timers.
 *    - Lo filtra fuera del array de toasts.
 * 5. Si pasan los 10s sin cerrar → el setTimeout se dispara y hace lo mismo
 *    (elimina del mapa y filtra del array).
 *
 * ¿Por qué useRef para los timers?
 * Porque crear/borrar timers no necesita provocar re-renders. Solo el array
 * `toasts` es estado reactivo (cuando cambia, React re-renderiza la UI).
 */

import { createContext, useState, useCallback, useRef, type ReactNode } from "react";

/** Variantes visuales disponibles — cada una se mapea a un color del tema CSS */
export type ToastVariant = "success" | "danger" | "warning" | "info";

export interface Toast {
  id: string;            // Identificador único (UUID v4)
  message: string;       // Texto que ve el usuario
  variant: ToastVariant; // Determina colores: verde/rojo/amarillo/azul
}

interface ToastContextValue {
  toasts: Toast[];                                             // Array de toasts activos
  addToast: (message: string, variant?: ToastVariant) => void; // Crear un toast nuevo
  removeToast: (id: string) => void;                           // Cerrar un toast por ID
}

/** Milisegundos que un toast permanece visible antes de auto-eliminarse */
const TOAST_DURATION = 10_000;

/**
 * Valor inicial null — si un componente intenta usar useToast() sin estar
 * dentro de <ToastProvider>, el hook useToast lanza un error descriptivo.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  /** Array reactivo: cada cambio aquí re-renderiza el ToastContainer */
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * Mapa id → timer (setTimeout handle).
   * Permite cancelar el auto-dismiss si el usuario cierra el toast antes.
   * Es un useRef porque mutar este mapa no necesita provocar re-renders.
   */
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * removeToast — Elimina un toast inmediatamente.
   * 1. Busca si tiene un timer pendiente → lo cancela con clearTimeout.
   * 2. Lo borra del mapa de timers.
   * 3. Lo filtra fuera del array reactivo → re-render → desaparece de la UI.
   */
  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * addToast — Crea y programa un toast nuevo.
   * 1. Genera UUID único.
   * 2. Lo añade al final del array (aparece abajo en la pila visual).
   * 3. Programa setTimeout → cuando expira, elimina el toast del array
   *    y limpia su entrada en el mapa de timers.
   * 4. Guarda el handle del timer en timersRef por si hay que cancelarlo.
   */
  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION);

      timersRef.current.set(id, timer);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}
