"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, PasswordInput, Select } from "@/components/ui";
import { PasswordRequirements } from "@/components/shared";
import { validateEmail, validatePassword } from "@/lib/validators";

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
}

interface UserFormProps {
  onSubmit: (data: UserFormData) => Promise<void> | void;
  initialValues?: Partial<UserFormData>;
  isEdit?: boolean;
}

/** Opciones de rol disponibles para el admin al crear/editar un usuario */
const roleOptions = [
  { value: "STUDENT", label: "Estudiante" },
  { value: "PROFESSOR", label: "Profesor" },
  { value: "LIBRARIAN", label: "Bibliotecario" },
  { value: "ADMIN", label: "Administrador" },
];

export function UserForm({ onSubmit, initialValues, isEdit }: UserFormProps) {
  const { fields, errors, submitError, loading, setField, handleSubmit } = useForm<UserFormData>({
    initialValues: {
      name: initialValues?.name ?? "",
      email: initialValues?.email ?? "",
      password: "",
      role: initialValues?.role ?? "STUDENT",
    },
    // Validación en tiempo real mientras el usuario escribe
    validateOnChange: true,
    validate: (v) => {
      const e: Partial<Record<keyof UserFormData, string>> = {};

      if (!v.name) e.name = "El nombre es obligatorio";

      // Mismas validaciones de email que el registro público
      const emailError = validateEmail(v.email);
      if (emailError) e.email = emailError;

      // En modo edición la contraseña es opcional (vacía = no cambiar)
      if (!isEdit) {
        const passwordError = validatePassword(v.password);
        if (passwordError) e.password = passwordError;
      } else if (v.password) {
        // Si está editando y escribe algo, validar igualmente
        const passwordError = validatePassword(v.password);
        if (passwordError) e.password = passwordError;
      }

      if (!v.role) e.role = "Selecciona un rol";

      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre completo"
        placeholder="Ej: Juan Pérez"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Input
        label="Email UCM"
        type="text"
        autoComplete="email"
        placeholder="Ej: usuario@ucm.es"
        value={fields.email}
        onChange={setField("email")}
        error={errors.email}
        disabled={isEdit}
      />

      {/* Contraseña con indicador visual de requisitos */}
      <div className="flex flex-col gap-2">
        <PasswordInput
          label={isEdit ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
          placeholder="Mínimo 8 caracteres"
          value={fields.password}
          onChange={setField("password")}
          error={errors.password}
        />
        {fields.password && <PasswordRequirements password={fields.password} />}
      </div>

      <Select
        label="Rol"
        options={roleOptions}
        value={fields.role}
        onChange={setField("role")}
        error={errors.role}
        disabled={isEdit}
      />

      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear usuario"}
      </Button>
    </form>
  );
}
