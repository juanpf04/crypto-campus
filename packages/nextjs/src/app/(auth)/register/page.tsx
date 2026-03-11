"use client";

import { useRouter } from "next/navigation";
import { RegisterForm, type RegisterFormData } from "@/components/forms";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();

  async function handleRegister(data: RegisterFormData) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        password: data.password,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error ?? "Error al registrar la cuenta");
    }

    router.push("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <p className="text-sm text-text-muted">Regístrate con tu email institucional UCM</p>
        </CardHeader>
        <CardBody>
          <RegisterForm onSubmit={handleRegister} />
          <p className="mt-4 text-center text-sm text-text-muted">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="font-medium text-primary hover:underline">
              Inicia sesión
            </a>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
