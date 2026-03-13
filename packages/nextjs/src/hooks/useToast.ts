"use client";

/**
 * useToast — Hook de acceso rápido al sistema de notificaciones.
 *
 * Flujo:
 * 1. Un componente llama a: const { addToast, removeToast, toasts } = useToast();
 * 2. Internamente hace useContext(ToastContext) para obtener el valor del provider.
 * 3. Si no encuentra el contexto (componente fuera de <ToastProvider>), lanza
 *    un error claro para que el desarrollador sepa que falta el provider.
 *
 * Uso típico en un componente:
 *   const { addToast } = useToast();
 *   addToast("Login exitoso", "success");           // Toast verde
 *   addToast("Credenciales incorrectas", "danger"); // Toast rojo
 */

import { useContext } from "react";
import { ToastContext } from "@/contexts/ToastContext";

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
