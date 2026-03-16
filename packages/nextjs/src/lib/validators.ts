/**
 * Funciones de validación compartidas.
 *
 * Se usan en RegisterForm y UserForm para evitar duplicar
 * las mismas reglas de email y contraseña en dos archivos.
 */

/**
 * Valida un email institucional UCM.
 * - Obligatorio
 * - Debe contener @
 * - Debe terminar en @ucm.es
 * - Debe tener un usuario antes del @
 */
export function validateEmail(email: string): string | undefined {
  if (!email) return "El email es obligatorio";
  if (!email.includes("@")) return "El email debe contener @";
  if (!email.endsWith("@ucm.es")) return "Debe ser un email @ucm.es";
  const [local] = email.split("@");
  if (!local || local.length === 0) return "Escribe tu usuario antes de @ucm.es";
  return undefined;
}

/**
 * Valida una contraseña segura.
 * - Mínimo 8 caracteres
 * - Al menos 1 mayúscula
 * - Al menos 1 minúscula
 * - Al menos 1 número
 * - Al menos 1 carácter especial
 */
export function validatePassword(password: string): string | undefined {
  if (!password) return "La contraseña es obligatoria";
  if (password.length < 8) return "Mínimo 8 caracteres";
  if (!/[A-Z]/.test(password)) return "Debe contener al menos 1 mayúscula";
  if (!/[a-z]/.test(password)) return "Debe contener al menos 1 minúscula";
  if (!/[0-9]/.test(password)) return "Debe contener al menos 1 número";
  if (!/[^A-Za-z0-9]/.test(password)) return "Debe contener al menos 1 carácter especial";
  return undefined;
}
