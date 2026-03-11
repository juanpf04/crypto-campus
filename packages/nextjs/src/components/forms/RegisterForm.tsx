"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input } from "@/components/ui";

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormProps {
  onSubmit: (data: RegisterFormData) => Promise<void> | void;
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<RegisterFormData>({
    initialValues: { name: "", email: "", password: "", confirmPassword: "" },
    validate: (v) => {
      const e: Partial<Record<keyof RegisterFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      if (!v.email) e.email = "El email es obligatorio";
      else if (!v.email.endsWith("@ucm.es")) e.email = "Debe ser un email @ucm.es";
      if (!v.password) e.password = "La contraseña es obligatoria";
      else if (v.password.length < 8) e.password = "Mínimo 8 caracteres";
      if (v.password !== v.confirmPassword) e.confirmPassword = "Las contraseñas no coinciden";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre completo"
        placeholder="Arturo García"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Input
        label="Email UCM"
        type="email"
        placeholder="tu@ucm.es"
        value={fields.email}
        onChange={setField("email")}
        error={errors.email}
      />
      <Input
        label="Contraseña"
        type="password"
        placeholder="Mínimo 8 caracteres"
        value={fields.password}
        onChange={setField("password")}
        error={errors.password}
      />
      <Input
        label="Confirmar contraseña"
        type="password"
        placeholder="Repite la contraseña"
        value={fields.confirmPassword}
        onChange={setField("confirmPassword")}
        error={errors.confirmPassword}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        Crear cuenta
      </Button>
    </form>
  );
}
