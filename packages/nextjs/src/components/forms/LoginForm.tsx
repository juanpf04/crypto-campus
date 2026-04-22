"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, PasswordInput } from "@/components/ui";

export interface LoginFormData {
  email: string;
  password: string;
}

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void> | void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const { fields, errors, loading, setField, handleSubmit } = useForm<LoginFormData>({
    initialValues: { email: "", password: "" },
    validate: (v) => {
      const e: Partial<Record<keyof LoginFormData, string>> = {};
      if (!v.email) e.email = "El email es obligatorio";
      if (!v.password) e.password = "La contraseña es obligatoria";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Email"
        type="text"
        autoComplete="email"
        placeholder="Ej: tu@ucm.es"
        value={fields.email}
        onChange={setField("email")}
        error={errors.email}
      />
      <PasswordInput
        label="Contraseña"
        value={fields.password}
        onChange={setField("password")}
        error={errors.password}
      />
      <Button type="submit" loading={loading}>
        Iniciar sesión
      </Button>
    </form>
  );
}
