"use client";

import { useState, useCallback, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";

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
  /** Campos que el usuario ha tocado (para no mostrar errores antes de interactuar) */
  const touched = useRef<Set<keyof T>>(new Set());

  // Refs estables para callbacks que pueden cambiar en cada render
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Validación en tiempo real: se ejecuta cuando cambian los campos
  useEffect(() => {
    if (!validateOnChange || !validateRef.current) return;
    const allErrors = validateRef.current(fields);
    // Solo mostramos errores de campos que el usuario ya tocó
    const filtered: ValidationErrors<T> = {};
    for (const key of touched.current) {
      if (allErrors[key]) {
        filtered[key] = allErrors[key];
      }
    }
    setErrors(filtered);
  }, [fields, validateOnChange]);

  const setField = useCallback(
    (name: keyof T) =>
      (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        touched.current.add(name);
        setFields((prev) => ({ ...prev, [name]: e.target.value }));
        setSubmitError(null);
      },
    [],
  );

  const setFieldValue = useCallback(
    (name: keyof T, value: unknown) => {
      touched.current.add(name);
      setFields((prev) => ({ ...prev, [name]: value }));
      setSubmitError(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (validateRef.current) {
        // Al hacer submit, marcamos todos los campos como touched
        for (const key of Object.keys(fields) as Array<keyof T>) {
          touched.current.add(key);
        }
        const validationErrors = validateRef.current(fields);
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
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

  const reset = useCallback(() => {
    setFields(initialValues);
    setErrors({});
    setSubmitError(null);
    touched.current.clear();
  }, [initialValues]);

  return {
    fields,
    errors,
    submitError,
    loading,
    setField,
    setFieldValue,
    handleSubmit,
    reset,
  };
}
