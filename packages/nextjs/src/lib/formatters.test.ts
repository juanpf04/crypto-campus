import { describe, it, expect } from "vitest";
import {
  formatItemSummary,
  calculateOrderStats,
  buildVariantName,
  formatCredits,
  formatBytes,
  formatShortDate,
} from "./formatters";

describe("formatShortDate", () => {
  it("formatea ISO a fecha corta en español", () => {
    const result = formatShortDate("2026-03-23T10:00:00Z");
    expect(result).toContain("2026");
    expect(result).toMatch(/mar/i);
  });
});

describe("formatItemSummary", () => {
  it("devuelve cadena vacía si no hay items", () => {
    expect(formatItemSummary([])).toBe("");
  });

  it("muestra 1 nombre", () => {
    expect(
      formatItemSummary([{ product: { name: "Camiseta" } }]),
    ).toBe("Camiseta");
  });

  it("muestra 2 nombres separados por coma", () => {
    expect(
      formatItemSummary([
        { product: { name: "Camiseta" } },
        { product: { name: "Taza" } },
      ]),
    ).toBe("Camiseta, Taza");
  });

  it("agrupa con 'y N más' cuando hay >= 3", () => {
    expect(
      formatItemSummary([
        { product: { name: "Camiseta" } },
        { product: { name: "Taza" } },
        { product: { name: "Bolígrafo" } },
      ]),
    ).toBe("Camiseta y 2 más");
  });
});

describe("calculateOrderStats", () => {
  it("cuenta cero en lista vacía", () => {
    expect(calculateOrderStats([])).toEqual({
      paidCount: 0,
      deliveredCount: 0,
      returnedCount: 0,
    });
  });

  it("cuenta cada estado", () => {
    expect(
      calculateOrderStats([
        { status: "PAID" },
        { status: "PAID" },
        { status: "DELIVERED" },
        { status: "RETURNED" },
        { status: "OTHER" },
      ]),
    ).toEqual({ paidCount: 2, deliveredCount: 1, returnedCount: 1 });
  });
});

describe("buildVariantName", () => {
  it("capitaliza color simple", () => {
    expect(buildVariantName("Taza UCM 370ml", "negra")).toBe(
      "Taza UCM 370ml Negra",
    );
  });

  it("capitaliza color compuesto separado por guión", () => {
    expect(buildVariantName("Camiseta", "azul-marino")).toBe(
      "Camiseta Azul Marino",
    );
  });
});

describe("formatCredits", () => {
  it("muestra valor numérico tal cual si está bajo el límite", () => {
    expect(formatCredits(0)).toBe("0");
    expect(formatCredits(150)).toBe("150");
    expect(formatCredits(10000)).toBe("10000");
  });

  it("muestra 'Infinito' para valores grandes", () => {
    expect(formatCredits(10001)).toBe("Infinito");
    expect(formatCredits(999999)).toBe("Infinito");
  });

  it("devuelve string sin tocar", () => {
    expect(formatCredits("custom")).toBe("custom");
  });
});

describe("formatBytes", () => {
  it("muestra bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("muestra KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("muestra MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
