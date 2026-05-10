import { describe, it, expect } from "vitest";
import {
  slugify,
  normalizeColor,
  deriveBaseName,
  deriveColorFromImageUrl,
} from "./shop-utils";

describe("slugify", () => {
  it("convierte a minúsculas y separa con guiones", () => {
    expect(slugify("Hola Mundo")).toBe("hola-mundo");
  });

  it("elimina acentos y diacríticos", () => {
    expect(slugify("Camisetá Niño")).toBe("camiseta-nino");
  });

  it("elimina guiones extremos", () => {
    expect(slugify("--hola--")).toBe("hola");
  });

  it("colapsa caracteres no alfanuméricos a un solo guión", () => {
    expect(slugify("Producto / 2026")).toBe("producto-2026");
  });
});

describe("normalizeColor", () => {
  it("usa 'default' si no se pasa color", () => {
    expect(normalizeColor(null)).toBe("default");
    expect(normalizeColor(undefined)).toBe("default");
    expect(normalizeColor("")).toBe("default");
  });

  it("convierte a minúsculas y trimea", () => {
    expect(normalizeColor("  AZUL Marino  ")).toBe("azul marino");
  });
});

describe("deriveBaseName", () => {
  it("recorta el color al final si coincide capitalizado", () => {
    expect(deriveBaseName("Taza UCM 370ml Negra", "negra")).toBe(
      "Taza UCM 370ml",
    );
  });

  it("acepta color compuesto con guion", () => {
    expect(deriveBaseName("Camiseta Azul Marino", "azul-marino")).toBe(
      "Camiseta",
    );
  });

  it("devuelve el nombre sin tocar si el color no aparece", () => {
    expect(deriveBaseName("Producto sin variante", "negra")).toBe(
      "Producto sin variante",
    );
  });
});

describe("deriveColorFromImageUrl", () => {
  it("devuelve default si la URL es null", () => {
    expect(deriveColorFromImageUrl(null)).toBe("default");
  });

  it("extrae el penúltimo segmento como color", () => {
    expect(deriveColorFromImageUrl("/products/tazas/negra/main.webp")).toBe(
      "negra",
    );
  });

  it("normaliza el color extraído (minúsculas)", () => {
    expect(deriveColorFromImageUrl("/products/AZUL-Marino/main.webp")).toBe(
      "azul-marino",
    );
  });

  it("devuelve default si solo hay un segmento", () => {
    expect(deriveColorFromImageUrl("/main.webp")).toBe("default");
  });
});
