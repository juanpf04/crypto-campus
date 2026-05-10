import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "./useForm";

interface LoginFields {
  email: string;
  password: string;
}

describe("useForm", () => {
  it("inicializa con los valores dados", () => {
    const { result } = renderHook(() =>
      useForm<LoginFields>({
        initialValues: { email: "", password: "" },
        onSubmit: async () => {},
      }),
    );

    expect(result.current.fields).toEqual({ email: "", password: "" });
    expect(result.current.errors).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(result.current.submitError).toBeNull();
  });

  it("setFieldValue actualiza un campo y marca como tocado", () => {
    const { result } = renderHook(() =>
      useForm<LoginFields>({
        initialValues: { email: "", password: "" },
        onSubmit: async () => {},
      }),
    );

    act(() => {
      result.current.setFieldValue("email", "user@ucm.es");
    });

    expect(result.current.fields.email).toBe("user@ucm.es");
  });

  it("reset restaura valores iniciales", () => {
    const { result } = renderHook(() =>
      useForm<LoginFields>({
        initialValues: { email: "", password: "" },
        onSubmit: async () => {},
      }),
    );

    act(() => {
      result.current.setFieldValue("email", "x@ucm.es");
    });
    expect(result.current.fields.email).toBe("x@ucm.es");

    act(() => {
      result.current.reset();
    });

    expect(result.current.fields).toEqual({ email: "", password: "" });
  });

  it("captura errores de onSubmit en submitError", async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error("Credenciales incorrectas");
    });

    const { result } = renderHook(() =>
      useForm<LoginFields>({
        initialValues: { email: "x@ucm.es", password: "Abc1!def" },
        onSubmit,
      }),
    );

    const fakeEvent = {
      preventDefault: () => {},
      currentTarget: {
        querySelector: () => null,
      },
    } as unknown as React.FormEvent<HTMLFormElement>;

    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(result.current.submitError).toBe("Credenciales incorrectas");
    expect(result.current.loading).toBe(false);
  });

  it("aborta el submit si hay errores de validación", async () => {
    const onSubmit = vi.fn();
    const validate = vi.fn(() => ({ email: "Email obligatorio" }));

    const { result } = renderHook(() =>
      useForm<LoginFields>({
        initialValues: { email: "", password: "" },
        validate,
        onSubmit,
      }),
    );

    const fakeEvent = {
      preventDefault: () => {},
      currentTarget: {
        querySelector: () => null,
      },
    } as unknown as React.FormEvent<HTMLFormElement>;

    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.email).toBe("Email obligatorio");
  });
});
