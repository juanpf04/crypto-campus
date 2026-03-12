"use client";

import { useForm } from "@/hooks/useForm";
import { Button, Input, PasswordInput, Select } from "@/components/ui";

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

const roleOptions = [
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
      role: initialValues?.role ?? "PROFESSOR",
    },
    validate: (v) => {
      const e: Partial<Record<keyof UserFormData, string>> = {};
      if (!v.name) e.name = "El nombre es obligatorio";
      if (!v.email) e.email = "El email es obligatorio";
      if (!isEdit && !v.password) e.password = "La contraseña es obligatoria";
      if (!isEdit && v.password && v.password.length < 8) e.password = "Mínimo 8 caracteres";
      if (!v.role) e.role = "Selecciona un rol";
      return e;
    },
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Nombre completo"
        placeholder="Nombre del usuario"
        value={fields.name}
        onChange={setField("name")}
        error={errors.name}
      />
      <Input
        label="Email"
        type="text"
        autoComplete="email"
        placeholder="usuario@ucm.es"
        value={fields.email}
        onChange={setField("email")}
        error={errors.email}
        disabled={isEdit}
      />
      <PasswordInput
        label={isEdit ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
        placeholder="Mínimo 8 caracteres"
        value={fields.password}
        onChange={setField("password")}
        error={errors.password}
      />
      <Select
        label="Rol"
        options={roleOptions}
        value={fields.role}
        onChange={setField("role")}
        error={errors.role}
      />
      {submitError && <p className="text-sm text-danger">{submitError}</p>}
      <Button type="submit" loading={loading}>
        {isEdit ? "Guardar cambios" : "Crear usuario"}
      </Button>
    </form>
  );
}
