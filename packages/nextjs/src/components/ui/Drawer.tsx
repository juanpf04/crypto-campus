"use client";

/**
 * Drawer — Panel lateral slide-in genérico.
 *
 * Componente atómico reutilizable para cualquier panel lateral:
 * carrito, filtros, notificaciones, configuración, etc.
 *
 * Se desliza desde el lado indicado con animación CSS.
 * Overlay semitransparente que cierra al hacer clic fuera.
 * Trap de scroll: el body no hace scroll mientras está abierto.
 *
 * Props:
 * - open: controla visibilidad
 * - onClose: callback al cerrar (clic en overlay o botón X)
 * - title: título del panel (opcional)
 * - side: "left" | "right" (default "right")
 * - width: ancho del panel (default "max-w-md")
 * - children: contenido del drawer
 */

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DrawerSide = "left" | "right";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  side?: DrawerSide;
  width?: string;
  children: ReactNode;
  className?: string;
  /** Contenido fijo en la parte inferior del drawer (por encima del scroll) */
  footer?: ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  width = "max-w-md",
  children,
  className,
  footer,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Panel lateral"}
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col bg-card border-border-default shadow-xl",
          "transition-transform duration-300 ease-in-out",
          "w-full",
          width,
          // Posición y dirección de slide
          side === "right" && "right-0 border-l",
          side === "left" && "left-0 border-r",
          // Animación de entrada/salida
          side === "right" && (open ? "translate-x-0" : "translate-x-full"),
          side === "left" && (open ? "translate-x-0" : "-translate-x-full"),
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4 shrink-0">
          {title && (
            <h2 className="text-lg font-semibold text-text">{title}</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-text-muted hover:text-text hover:bg-border-default transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Footer fijo */}
        {footer && (
          <div className="border-t border-border-default px-5 py-4 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
