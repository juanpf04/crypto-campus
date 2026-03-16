"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, PasswordInput } from "@/components/ui";
import { PasswordRequirements } from "@/components/shared";
import { validateEmail, validatePassword } from "@/lib/validators";

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
    validateOnChange: true,
    validate: (v) => {
      const e: Partial<Record<keyof RegisterFormData, string>> = {};

      if (!v.name) e.name = "El nombre es obligatorio";

      const emailError = validateEmail(v.email);
      if (emailError) e.email = emailError;

      const passwordError = validatePassword(v.password);
      if (passwordError) e.password = passwordError;

      if (!v.confirmPassword) {
        e.confirmPassword = "Confirma tu contraseña";
      } else if (v.password !== v.confirmPassword) {
        e.confirmPassword = "Las contraseñas no coinciden";
      }

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
        type="text"
        placeholder="tu@ucm.es"
        autoComplete="email"
        value={fields.email}
        onChange={setField("email")}
        error={errors.email}
      />
      <div className="flex flex-col gap-2">
        <PasswordInput
          label="Contraseña"
          placeholder="Crea una contraseña segura"
          value={fields.password}
          onChange={setField("password")}
          error={errors.password}
        />
        {fields.password && <PasswordRequirements password={fields.password} />}
      </div>
      <PasswordInput
        label="Confirmar contraseña"
        placeholder="Repite la contraseña"
        value={fields.confirmPassword}
        onChange={setField("confirmPassword")}
        error={errors.confirmPassword}
      />
      <Button type="submit" loading={loading}>
        Crear cuenta
      </Button>
    </form>
  );
}
