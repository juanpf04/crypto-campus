import { describe, it, expect } from "vitest";
import { validateEmail, validatePassword } from "./validators";

describe("validateEmail", () => {
  it("rechaza email vacío", () => {
    expect(validateEmail("")).toBe("El email es obligatorio");
  });

  it("rechaza email sin @", () => {
    expect(validateEmail("usuariosinarroba")).toBe("El email debe contener @");
  });

  it("rechaza email con dominio incorrecto", () => {
    expect(validateEmail("alguien@gmail.com")).toBe("Debe ser un email @ucm.es");
  });

  it("rechaza email con local vacío", () => {
    expect(validateEmail("@ucm.es")).toBe(
      "Escribe tu usuario antes de @ucm.es",
    );
  });

  it("acepta email UCM válido", () => {
    expect(validateEmail("alguien@ucm.es")).toBeUndefined();
    expect(validateEmail("nombre.apellido@ucm.es")).toBeUndefined();
  });
});

describe("validatePassword", () => {
  it("rechaza contraseña vacía", () => {
    expect(validatePassword("")).toBe("La contraseña es obligatoria");
  });

  it("rechaza contraseña corta", () => {
    expect(validatePassword("Aa1!aa")).toBe("Mínimo 8 caracteres");
  });

  it("rechaza sin mayúscula", () => {
    expect(validatePassword("abcdefg1!")).toBe(
      "Debe contener al menos 1 mayúscula",
    );
  });

  it("rechaza sin minúscula", () => {
    expect(validatePassword("ABCDEFG1!")).toBe(
      "Debe contener al menos 1 minúscula",
    );
  });

  it("rechaza sin número", () => {
    expect(validatePassword("Abcdefgh!")).toBe(
      "Debe contener al menos 1 número",
    );
  });

  it("rechaza sin carácter especial", () => {
    expect(validatePassword("Abcdefg1")).toBe(
      "Debe contener al menos 1 carácter especial",
    );
  });

  it("acepta contraseña válida", () => {
    expect(validatePassword("Abcdef1!")).toBeUndefined();
    expect(validatePassword("MiPass123$")).toBeUndefined();
  });
});
