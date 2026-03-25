/**
 * Layout de la tienda del estudiante.
 *
 * Monta el CartProvider y el CartDrawer compartido entre todas
 * las páginas de la tienda (catálogo, detalle, pedidos, etc.).
 * Así el drawer del carrito es accesible desde cualquier página
 * sin duplicar código.
 */

"use client";

import { type ReactNode } from "react";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { CartDrawer } from "@/components/shared/CartDrawer";
import { FloatingCartButton } from "@/components/ui/FloatingCartButton";

function ShopLayoutInner({ children }: { children: ReactNode }) {
  const { isCartOpen, openCart, closeCart, itemCount, setItemCount } = useCart();

  return (
    <>
      {children}
      <FloatingCartButton itemCount={itemCount} onClick={openCart} />
      <CartDrawer
        open={isCartOpen}
        onClose={closeCart}
        onCartChange={(count) => setItemCount(count)}
      />
    </>
  );
}

export default function StudentShopLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <ShopLayoutInner>{children}</ShopLayoutInner>
    </CartProvider>
  );
}
