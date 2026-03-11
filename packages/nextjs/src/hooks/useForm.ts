"use client";

import { useState, useCallback, type FormEvent, type ChangeEvent } from "react";

type ValidationErrors<T> = Partial<Record<keyof T, string>>;

interface UseFormOptions<T extends object> {
  initialValues: T;
  validate?: (values: T) => ValidationErrors<T>;
  onSubmit: (values: T) => Promise<void> | void;
}

export function useForm<T extends object>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>) {
  const [fields, setFields] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setField = useCallback(
    (name: keyof T) =>
      (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFields((prev) => ({ ...prev, [name]: e.target.value }));
        setErrors((prev) => ({ ...prev, [name]: undefined }));
        setSubmitError(null);
      },
    [],
  );

  const setFieldValue = useCallback(
    (name: keyof T, value: unknown) => {
      setFields((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: undefined }));
      setSubmitError(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (validate) {
        const validationErrors = validate(fields);
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          return;
        }
      }

      setLoading(true);
      setSubmitError(null);
      try {
        await onSubmit(fields);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    },
    [fields, validate, onSubmit],
  );

  const reset = useCallback(() => {
    setFields(initialValues);
    setErrors({});
    setSubmitError(null);
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
