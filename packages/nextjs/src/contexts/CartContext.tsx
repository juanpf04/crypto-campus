"use client";

/**
 * CartContext — Contexto global para controlar el drawer del carrito.
 *
 * Permite que cualquier página de la tienda abra/cierre el drawer
 * del carrito y actualice el contador de items sin prop drilling.
 *
 * Se monta en el layout de la tienda del estudiante.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CartContextValue {
  /** Número de items en el carrito */
  itemCount: number;
  /** Abrir el drawer del carrito */
  openCart: () => void;
  /** Cerrar el drawer del carrito */
  closeCart: () => void;
  /** ¿Está abierto el drawer? */
  isCartOpen: boolean;
  /** Actualizar el contador de items */
  setItemCount: (count: number) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [itemCount, setItemCount] = useState(0);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  return (
    <CartContext.Provider value={{ itemCount, openCart, closeCart, isCartOpen, setItemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
