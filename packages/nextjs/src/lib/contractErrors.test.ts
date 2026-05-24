import { describe, it, expect } from "vitest";
import {
  isContractPauseError,
  isNonceError,
  isKnownContractError,
  translateContractError,
} from "./contractErrors";

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

describe("isNonceError", () => {
  it("detecta 'nonce too low'", () => {
    const err = new Error("nonce too low — the txn nonce is stale");
    expect(isNonceError(err)).toBe(true);
  });

  it("detecta el mensaje largo de viem 'Nonce provided ... is lower'", () => {
    const err = new Error(
      "Nonce provided for the transaction is lower than the current nonce of the account.",
    );
    expect(isNonceError(err)).toBe(true);
  });

  it("no detecta otros errores", () => {
    expect(isNonceError(new Error("EnforcedPause"))).toBe(false);
    expect(isNonceError(new Error("Insufficient balance"))).toBe(false);
    expect(isNonceError(null)).toBe(false);
  });
});

describe("isKnownContractError", () => {
  it("es true para errores de pausa", () => {
    expect(isKnownContractError(new Error("EnforcedPause"))).toBe(true);
  });

  it("es true para errores de nonce", () => {
    expect(isKnownContractError(new Error("nonce too low"))).toBe(true);
  });

  it("es false para errores desconocidos", () => {
    expect(isKnownContractError(new Error("Insufficient balance"))).toBe(false);
    expect(isKnownContractError(null)).toBe(false);
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

  it("traduce errores de nonce a mensaje accionable (sin detalles técnicos)", () => {
    const original = new Error(
      "Nonce provided for the transaction is lower than the current nonce of the account.",
    );
    const translated = translateContractError(original, "Biblioteca");
    expect(translated.message).toMatch(/conflicto temporal/i);
    expect(translated.message).toMatch(/vuelve a intentarlo/i);
    // No debe filtrar terminología técnica de viem al usuario
    expect(translated.message).not.toMatch(/nonce/i);
    expect(translated.message).not.toMatch(/transaction/i);
  });

  it("devuelve el error original si no es pausa ni nonce", () => {
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
