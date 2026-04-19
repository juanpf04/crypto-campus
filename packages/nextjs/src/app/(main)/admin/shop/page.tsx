"use client";

/**
 * Panel de tienda del admin — Vista resumen.
 *
 * Mismo patrón que admin/printing:
 * - Zona superior: StatCards con estadísticas reales (4 columnas)
 * - Zona inferior: ActionRows con accesos rápidos a gestión
 */

import { useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { icons } from "@/components/ui/icons";
import { DashboardGreeting } from "@/components/shared/DashboardGreeting";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatCard } from "@/components/shared/StatCard";
import { ActionRow } from "@/components/shared/ActionRow";
import { Card } from "@/components/ui/Card";
import { SkeletonPage } from "@/components/ui/Skeleton";

export default function AdminShopPage() {
  const { user, loading: authLoading } = useAuthUser();
  const [stats, setStats] = useState({
    activeProducts: "—" as string | number,
    totalProducts: "—" as string | number,
    totalOrders: "—" as string | number,
    paidOrders: "—" as string | number,
    deliveredOrders: "—" as string | number,
    returnedOrders: "—" as string | number,
    tokensInCirculation: "—" as string | number,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shop/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats({
          activeProducts: data.activeProducts ?? "—",
          totalProducts: data.totalProducts ?? "—",
          totalOrders: data.totalOrders ?? "—",
          paidOrders: data.PAID ?? 0,
          deliveredOrders: data.DELIVERED ?? 0,
          returnedOrders: data.RETURNED ?? 0,
          tokensInCirculation: data.tokensInCirculation ?? "—",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (authLoading || loading) return <SkeletonPage />;

  return (
    <div className="space-y-10">
      <DashboardGreeting
        name={user?.name ?? "Admin"}
        subtitle="Gestión de la tienda del campus"
      />

      {/* ── Estadísticas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.shop}>Resumen</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Productos activos"
            value={stats.activeProducts}
            subtitle={`${stats.totalProducts} en total`}
            icon={icons.items}
          />
          <StatCard
            title="Pedidos totales"
            value={stats.totalOrders}
            subtitle={`${stats.paidOrders} pendientes de entrega`}
            icon={icons.orders}
          />
          <StatCard
            title="Entregas realizadas"
            value={stats.deliveredOrders}
            subtitle={`${stats.returnedOrders} devueltos`}
            icon={icons.orders}
          />
          <StatCard
            title="ShopTokens en circulación"
            value={stats.tokensInCirculation}
            subtitle="Total en manos de usuarios"
            icon={icons.token}
          />
        </div>
      </section>

      {/* ── Acciones rápidas ── */}
      <section className="space-y-4">
        <SectionTitle icon={icons.items}>Gestión</SectionTitle>
        <Card className="overflow-hidden p-0">
          <ActionRow
            href="/admin/shop/products"
            icon={icons.items}
            title="Productos"
            description="Añadir, editar y desactivar productos del catálogo"
            stat={`${stats.activeProducts} activos`}
          />
          <ActionRow
            href="/admin/shop/orders"
            icon={icons.orders}
            title="Pedidos"
            description="Gestionar pedidos, entregas y devoluciones"
            stat={`${stats.totalOrders} pedidos`}
          />
          <ActionRow
            href="/admin/shop/tokens"
            icon={icons.token}
            title="ShopTokens"
            description="Consultar y asignar tokens a estudiantes"
            stat={`${stats.tokensInCirculation} en circulación`}
          />
          <ActionRow
            href="/admin/shop/transactions"
            icon={icons.pending}
            title="Transacciones"
            description="Historial de compras, recargas e ingresos de todos los usuarios"
            stat="Log completo"
            isLast
          />
        </Card>
      </section>
    </div>
  );
}
