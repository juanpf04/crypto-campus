"use client";

/**
 * Página de edición de usuario (admin).
 *
 * - Carga los datos actuales del usuario vía GET /api/admin/users/[id].
 * - Permite editar nombre y contraseña (vacía = no cambiar).
 * - Email y rol son de solo-lectura (el UserForm los deshabilita cuando isEdit=true).
 * - Al enviar hace PATCH con los campos editables.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { UserForm, type UserFormData } from "@/components/forms/UserForm";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { BackLink } from "@/components/ui/BackLink";
import { SkeletonPage } from "@/components/ui/Skeleton";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { addToast } = useToast();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${params.id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Error al cargar el usuario", "danger");
    } finally {
      setLoading(false);
    }
  }, [params.id, addToast]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const handleSubmit = async (data: UserFormData) => {
    // Enviamos solo los campos editables. Password vacía = no cambiar.
    const payload: { name: string; password?: string } = { name: data.name };
    if (data.password) payload.password = data.password;

    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok) {
      addToast(body.error ?? "Error al actualizar el usuario", "danger");
      throw new Error(body.error ?? "Error al actualizar el usuario");
    }

    addToast("Cambios guardados", "success");
    router.push("/admin/users");
  };

  if (loading) return <SkeletonPage />;
  if (notFound || !user) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-lg space-y-4">
          <BackLink href="/admin/users" label="Volver a usuarios" />
          <p className="text-danger">Usuario no encontrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-lg space-y-4">
        <BackLink href="/admin/users" label="Volver a usuarios" />

        <Card>
          <CardHeader>
            <CardTitle>Editar usuario</CardTitle>
            <p className="text-sm text-muted">
              Email y rol no se pueden modificar. Deja la contraseña vacía para mantener la actual.
            </p>
          </CardHeader>

          <CardBody>
            <UserForm
              onSubmit={handleSubmit}
              isEdit
              initialValues={{ name: user.name, email: user.email, role: user.role }}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
