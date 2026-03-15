"use client";

/**
 * dashboard/page.tsx — Página de redirección por rol.
 *
 * Cuando el usuario navega a /dashboard (tras login o directamente),
 * esta página consulta su rol y lo redirige a /dashboard/{rol}.
 * Mientras tanto muestra un spinner de carga.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        const role = (data.user?.role as string)?.toLowerCase();
        if (role) {
          // replace en vez de push para que no quede en el historial
          router.replace(`/dashboard/${role}`);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  );
}
