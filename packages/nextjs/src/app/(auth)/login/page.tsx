"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm, type LoginFormData } from "@/components/forms";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui";
import { useToast } from "@/hooks/useToast";

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

    // Redirigir a returnUrl si existe, o al panel del rol
    const returnUrl = searchParams.get("returnUrl");
    if (returnUrl) {
      router.push(returnUrl);
    } else {
      const role = (json.user?.role as string)?.toLowerCase() || "student";
      router.push(`/${role}`);
    }
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
