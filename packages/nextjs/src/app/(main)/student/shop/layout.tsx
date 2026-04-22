/**
 * Layout de la tienda del estudiante.
 *
 * Monta el CartProvider, el ShopCartDrawer, el FloatingCartButton
 * y el PurchaseOverlay compartidos entre todas las páginas de la tienda.
 */

"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { ShopCartDrawer } from "@/components/dashboard/ShopCartDrawer";
import { FloatingCartButton } from "@/components/ui/FloatingCartButton";
import { PurchaseOverlay } from "@/components/shared/PurchaseOverlay";

function ShopLayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();
  const {
    isCartOpen, openCart, closeCart,
    itemCount, setItemCount,
    purchaseState, endPurchase,
  } = useCart();

  // Detectar cuando la URL cambia para desactivar el overlay
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname && purchaseState.active) {
      endPurchase();
    }
    prevPathname.current = pathname;
  }, [pathname, purchaseState.active, endPurchase]);

  // Callback cuando el overlay termina
  const handlePurchaseComplete = useCallback((batchId: string | null) => {
    if (batchId) {
      addToast("Compra realizada correctamente", "success");
      router.replace(`/student/shop/orders/batch/${batchId}`);
    } else {
      endPurchase();
    }
  }, [router, addToast, endPurchase]);

  // Si hay compra en curso, mostrar el overlay encima de todo
  if (purchaseState.active && purchaseState.promise) {
    return (
      <PurchaseOverlay
        productName={purchaseState.productName}
        purchasePromise={purchaseState.promise}
        onComplete={handlePurchaseComplete}
      />
    );
  }

  return (
    <>
      {children}
      <FloatingCartButton itemCount={itemCount} onClick={openCart} />
      <ShopCartDrawer
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
