import type { ReactNode } from "react";
import { ModuleGuard } from "@/components/shared/ModuleGuard";
import { ShopCartLayoutClient } from "./ShopCartLayoutClient";

/**
 * Layout server-side de /student/shop/*.
 *
 * 1. Bloquea (server-side) si el módulo Shop está pausado y el usuario no es
 *    admin → renderiza ModulePausedScreen, los providers de cliente no se
 *    montan ni se ejecuta nada del cart.
 * 2. Si el módulo está activo, delega a `ShopCartLayoutClient` que monta el
 *    CartProvider, el FloatingCartButton, el ShopCartDrawer y el
 *    PurchaseOverlay.
 */
export default function StudentShopLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGuard moduleId="shop">
      <ShopCartLayoutClient>{children}</ShopCartLayoutClient>
    </ModuleGuard>
  );
}
