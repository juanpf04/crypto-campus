"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, PasswordInput } from "@/components/ui";
import { PasswordRequirements } from "@/components/shared";

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface RegisterFormProps {
  onSubmit: (data: RegisterFormData) => Promise<void> | void;
}

function validateEmail(email: string): string | undefined {
  if (!email) return "El email es obligatorio";
  if (!email.includes("@")) return "El email debe contener @";
  if (!email.endsWith("@ucm.es")) return "Debe ser un email @ucm.es";
  // Validar que hay algo antes del @
  const [local] = email.split("@");
  if (!local || local.length === 0) return "Escribe tu usuario antes de @ucm.es";
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return "La contraseña es obligatoria";
  if (password.length < 8) return "Mínimo 8 caracteres";
  if (!/[A-Z]/.test(password)) return "Debe contener al menos 1 mayúscula";
  if (!/[a-z]/.test(password)) return "Debe contener al menos 1 minúscula";
  if (!/[0-9]/.test(password)) return "Debe contener al menos 1 número";
  if (!/[^A-Za-z0-9]/.test(password)) return "Debe contener al menos 1 carácter especial";
  return undefined;
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
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        Crear cuenta
      </Button>
    </form>
  );
}
