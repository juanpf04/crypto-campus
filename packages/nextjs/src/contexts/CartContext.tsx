"use client";

/**
 * CartContext — Contexto global para el carrito y el flujo de compra.
 *
 * Controla:
 * - Drawer del carrito (abrir/cerrar)
 * - Contador de items para el botón flotante
 * - Estado de compra en curso (overlay de procesamiento)
 *
 * Se monta en el layout de la tienda del estudiante.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PurchaseState {
  active: boolean;
  promise: Promise<string | null> | null;
  productName: string;
}

interface CartContextValue {
  /** Número de items en el carrito */
  itemCount: number;
  /** Actualizar el contador de items */
  setItemCount: (count: number) => void;
  /** Abrir el drawer del carrito */
  openCart: () => void;
  /** Cerrar el drawer del carrito */
  closeCart: () => void;
  /** ¿Está abierto el drawer? */
  isCartOpen: boolean;
  /** Estado de la compra en curso (para el overlay) */
  purchaseState: PurchaseState;
  /** Iniciar una compra con overlay */
  startPurchase: (promise: Promise<string | null>, productName: string) => void;
  /** Finalizar la compra (limpiar overlay) */
  endPurchase: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>({
    active: false,
    promise: null,
    productName: "",
  });

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const startPurchase = useCallback((promise: Promise<string | null>, productName: string) => {
    setPurchaseState({ active: true, promise, productName });
  }, []);

  const endPurchase = useCallback(() => {
    setPurchaseState({ active: false, promise: null, productName: "" });
  }, []);

  return (
    <CartContext.Provider value={{
      itemCount, setItemCount,
      openCart, closeCart, isCartOpen,
      purchaseState, startPurchase, endPurchase,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
