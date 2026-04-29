"use client";

/**
 * useForm — Hook genérico para gestionar formularios con validación.
 *
 * Flujo completo:
 *
 * 1. INICIALIZACIÓN: El componente llama a useForm({ initialValues, validate, onSubmit }).
 *    - Se crea el estado `fields` con los valores iniciales.
 *    - Se crean estados para `errors` (por campo), `submitError` (global) y `loading`.
 *    - Se crea un Set `touched` (ref) para rastrear qué campos ha tocado el usuario.
 *    - Se guardan `validate` y `onSubmit` en refs estables para evitar re-renders
 *      infinitos (si el componente padre recrea estas funciones en cada render,
 *      las refs siempre apuntan a la versión más reciente sin cambiar la referencia).
 *
 * 2. INTERACCIÓN DEL USUARIO: Cuando escribe en un input:
 *    - El input llama a setField("email")(evento).
 *    - Se marca el campo como "touched" (el usuario ya interactuó con él).
 *    - Se actualiza el valor en `fields`.
 *    - Se limpia cualquier submitError previo.
 *
 * 3. VALIDACIÓN EN TIEMPO REAL (si validateOnChange = true):
 *    - El useEffect se dispara cada vez que `fields` cambia.
 *    - Ejecuta validate(fields) para obtener TODOS los errores.
 *    - Filtra: solo muestra errores de campos que el usuario ya tocó
 *      (así no ves errores en campos que aún no has rellenado).
 *    - Actualiza el estado `errors` con los errores filtrados.
 *
 * 4. SUBMIT DEL FORMULARIO:
 *    a. Se previene el comportamiento por defecto del form (preventDefault).
 *    b. Se marcan TODOS los campos como touched (para mostrar todos los errores).
 *    c. Se ejecuta validate(fields):
 *       - Si hay errores → se muestran y se aborta (no se llama a onSubmit).
 *       - Si no hay errores → continúa.
 *    d. Se activa loading = true y se limpia submitError.
 *    e. Se ejecuta onSubmit(fields) (la función async que el componente pasó).
 *       - Si onSubmit lanza un Error → se captura y se guarda en submitError.
 *       - Si todo va bien → el componente decide qué hacer (redirigir, etc.).
 *    f. Finalmente, loading = false.
 *
 * 5. RESET: Vuelve todo al estado inicial (valores, errores, touched).
 */

import React, { useState, useCallback, useEffect, useRef } from "react";

/** Mapa parcial de campo → mensaje de error. Solo incluye campos con error. */
type ValidationErrors<T> = Partial<Record<keyof T, string>>;

interface UseFormOptions<T extends object> {
  initialValues: T;
  validate?: (values: T) => ValidationErrors<T>;
  onSubmit: (values: T) => Promise<void> | void;
  /** Si es true, ejecuta validate() en cada cambio de campo (tiempo real) */
  validateOnChange?: boolean;
}

export function useForm<T extends object>({
  initialValues,
  validate,
  onSubmit,
  validateOnChange = false,
}: UseFormOptions<T>) {
  const [fields, setFields] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Set de nombres de campo que el usuario ya ha tocado (interactuado) */
  const touched = useRef<Set<keyof T>>(new Set());

  /**
   * Refs estables para evitar dependencias inestables en useEffect/useCallback.
   * Problema: si el componente padre define validate/onSubmit inline, se recrean
   * en cada render → si los pusiéramos en el array de dependencias, provocarían
   * re-ejecuciones infinitas. Con refs, siempre apuntan a la última versión
   * sin cambiar su identidad referencial.
   */
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  /**
   * VALIDACIÓN EN TIEMPO REAL
   * Se ejecuta cuando `fields` cambia (el usuario escribe).
   * - Llama a validate(fields) para obtener todos los errores posibles.
   * - Filtra: solo conserva errores de campos que el usuario ya tocó.
   * - Resultado: el usuario ve errores solo en campos con los que ya interactuó.
   */
  useEffect(() => {
    if (!validateOnChange || !validateRef.current) return;
    const allErrors = validateRef.current(fields);
    const filtered: ValidationErrors<T> = {};
    for (const key of touched.current) {
      if (allErrors[key]) {
        filtered[key] = allErrors[key];
      }
    }
    setErrors(filtered);
  }, [fields, validateOnChange]);

  /**
   * setField — Genera un handler de onChange para un campo específico.
   * Uso: <Input onChange={setField("email")} />
   * Al llamar setField("email") devuelve una función (e) => { ... }
   * que al ejecutarse marca el campo como touched, actualiza su valor
   * y limpia el submitError (el usuario está corrigiendo).
   */
  const setField = useCallback(
    (name: keyof T) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = e.currentTarget.value;
        touched.current.add(name);
        setFields((prev) => ({ ...prev, [name]: value }));
        setSubmitError(null);
      },
    [],
  );

  /**
   * setFieldValue — Igual que setField pero recibe el valor directamente.
   * Útil para selects custom, toggles, o cuando no hay un evento de input estándar.
   * Uso: setFieldValue("role", "STUDENT");
   */
  const setFieldValue = useCallback(
    (name: keyof T, value: unknown) => {
      touched.current.add(name);
      setFields((prev) => ({ ...prev, [name]: value }));
      setSubmitError(null);
    },
    [],
  );

  /**
   * handleSubmit — Se asigna al onSubmit del <form>.
   * Flujo:
   * 1. preventDefault() para evitar recarga de página.
   * 2. Marca todos los campos como touched (al dar submit quieres ver todos los errores).
   * 3. Ejecuta validación → si hay errores, los muestra, hace focus al primer
   *    `[aria-invalid="true"]` del form y aborta.
   * 4. Activa loading, llama a onSubmit(fields).
   * 5. Si onSubmit lanza Error → lo captura en submitError.
   * 6. Finalmente desactiva loading.
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;

      if (validateRef.current) {
        for (const key of Object.keys(fields) as Array<keyof T>) {
          touched.current.add(key);
        }
        const validationErrors = validateRef.current(fields);
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          // Esperamos a que React pinte los aria-invalid antes de hacer focus.
          requestAnimationFrame(() => {
            form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
          });
          return;
        }
      }

      setLoading(true);
      setSubmitError(null);
      try {
        await onSubmitRef.current(fields);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    },
    [fields],
  );

  /** reset — Restaura el formulario a su estado inicial (valores, errores, touched) */
  const reset = useCallback(() => {
    setFields(initialValues);
    setErrors({});
    setSubmitError(null);
    touched.current.clear();
  }, [initialValues]);

  return {
    fields,        // Valores actuales del formulario
    errors,        // Errores de validación por campo
    submitError,   // Error global de submit (ej: "Credenciales incorrectas")
    loading,       // true mientras onSubmit está ejecutándose
    setField,      // Genera onChange handler: setField("email")
    setFieldValue, // Setter directo: setFieldValue("role", "STUDENT")
    handleSubmit,  // Handler para <form onSubmit={handleSubmit}>
    reset,         // Vuelve todo al estado inicial
  };
}
