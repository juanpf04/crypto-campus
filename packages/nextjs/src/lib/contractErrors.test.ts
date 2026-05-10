import { describe, it, expect } from "vitest";
import { isContractPauseError, translateContractError } from "./contractErrors";

describe("isContractPauseError", () => {
  it("detecta errores con marcador 'EnforcedPause'", () => {
    const err = new Error("Contract revert: EnforcedPause()");
    expect(isContractPauseError(err)).toBe(true);
  });

  it("detecta errores con selector hexadecimal de EnforcedPause", () => {
    const err = new Error("Custom error 0xd93c0665 returned by contract");
    expect(isContractPauseError(err)).toBe(true);
  });

  it("no detecta otros errores genéricos", () => {
    expect(isContractPauseError(new Error("Insufficient balance"))).toBe(false);
    expect(isContractPauseError(new Error("ProductNotFound"))).toBe(false);
    expect(isContractPauseError(null)).toBe(false);
    expect(isContractPauseError(undefined)).toBe(false);
  });

  it("acepta strings y objetos no-Error", () => {
    expect(isContractPauseError("EnforcedPause")).toBe(true);
    expect(isContractPauseError("foo")).toBe(false);
  });
});

describe("translateContractError", () => {
  it("devuelve mensaje legible si es error de pausa", () => {
    const original = new Error("EnforcedPause()");
    const translated = translateContractError(original, "Biblioteca");
    expect(translated.message).toContain("Biblioteca");
    expect(translated.message).toContain("pausada");
    expect(translated.message).toMatch(/administrador/i);
  });

  it("incluye el moduleName entre paréntesis", () => {
    const err = translateContractError(
      new Error("EnforcedPause()"),
      "Tienda",
    );
    expect(err.message).toMatch(/\(Tienda\)/);
  });

  it("omite paréntesis si no se pasa moduleName", () => {
    const err = translateContractError(new Error("EnforcedPause()"));
    expect(err.message).not.toContain("(");
    expect(err.message).toContain("pausada");
  });

  it("devuelve el error original si no es pausa", () => {
    const original = new Error("Insufficient balance");
    const result = translateContractError(original, "Tienda");
    expect(result).toBe(original);
  });

  it("envuelve strings no-Error", () => {
    const result = translateContractError("plain string error");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("plain string error");
  });
});
