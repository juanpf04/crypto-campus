"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginForm, type LoginFormData } from "@/components/forms";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui";
import { useToast } from "@/hooks/useToast";

export default function LoginPage() {
  const router = useRouter();
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
    router.push("/dashboard");
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
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Regístrate
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
