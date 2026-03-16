"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { UserForm, type UserFormData } from "@/components/forms/UserForm";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";

/**
 * Página de creación de usuario para administradores.
 *
 * Flujo:
 * 1. Renderiza el formulario reutilizable UserForm (nombre, email, contraseña, rol).
 * 2. Al enviar, hace POST a /api/admin/users con los datos del formulario.
 * 3. Si la API responde OK → toast de éxito y redirige a la lista de usuarios.
 * 4. Si la API responde con error → toast de peligro con el mensaje del servidor.
 */
export default function NewUserPage() {
  const router = useRouter();
  const { addToast } = useToast();

  /** Envía los datos del formulario a la API de creación de usuarios */
  const handleSubmit = async (data: UserFormData) => {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const body = await res.json();

    if (!res.ok) {
      // Muestra el error devuelto por la API (ej: "El email ya está registrado")
      addToast(body.error ?? "Error al crear el usuario", "danger");
      throw new Error(body.error ?? "Error al crear el usuario");
    }

    // Éxito: notifica y vuelve a la lista
    addToast(`Usuario ${data.email} creado correctamente`, "success");
    router.push("/dashboard/admin/users");
  };

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-lg space-y-4">
        {/* Enlace de retorno a la lista de usuarios */}
        <BackLink href="/dashboard/admin/users" label="Volver a usuarios" />

        <Card>
          {/* Cabecera de la card */}
          <CardHeader>
            <CardTitle>Crear usuario</CardTitle>
            <p className="text-sm text-muted">
              Rellena los datos para registrar un nuevo usuario en la plataforma.
            </p>
          </CardHeader>

          {/* Formulario reutilizable de usuario */}
          <CardBody>
            <UserForm onSubmit={handleSubmit} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
