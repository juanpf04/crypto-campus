"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm, type LoginFormData } from "@/components/forms";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import {
  ROLE_FOLDER_BY_USER_ROLE,
  resolveRoleRoute,
  type UserRole,
} from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  async function handleLogin(data: LoginFormData) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      addToast(json.error ?? "Error al iniciar sesión", "danger");
      return;
    }

    addToast("Sesión iniciada correctamente", "success");

    // Redirigir según returnUrl + rol, con fallback al dashboard del rol.
    const returnUrl = searchParams.get("returnUrl");
    const pendingProductId = searchParams.get("pendingProductId");
    const pendingQty = searchParams.get("pendingQty") ?? "1";
    const role = ((json.user?.role as string)?.toUpperCase() || "STUDENT") as UserRole;
    const roleFolder = ROLE_FOLDER_BY_USER_ROLE[role];

    const targetPath = resolveRoleRoute(returnUrl, role);
    const shouldAppendPending = !!pendingProductId && targetPath === "/student/shop/cart";

    if (!shouldAppendPending) {
      router.push(targetPath || `/${roleFolder}`);
      return;
    }

    const query = new URLSearchParams({
      pendingProductId,
      pendingQty,
    });
    router.push(`${targetPath}?${query.toString()}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <p className="text-sm text-text-muted">Accede a CryptoCampus con tu cuenta UCM</p>
        </CardHeader>
        <CardBody>
          <LoginForm onSubmit={handleLogin} />
          <p className="mt-4 text-center text-sm text-text-muted">
            Si tienes problemas,{" "}
            <span className="font-medium text-primary">contacta con el administrador</span>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
