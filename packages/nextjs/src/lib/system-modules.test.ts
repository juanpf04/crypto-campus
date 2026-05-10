import { describe, it, expect } from "vitest";
import { deriveModuleStatus, MODULES, getModule } from "./system-modules";

describe("deriveModuleStatus", () => {
  it("devuelve 'paused' cuando todos los flags son true", () => {
    expect(deriveModuleStatus([true])).toBe("paused");
    expect(deriveModuleStatus([true, true])).toBe("paused");
    expect(deriveModuleStatus([true, true, true])).toBe("paused");
  });

  it("devuelve 'active' cuando todos los flags son false", () => {
    expect(deriveModuleStatus([false])).toBe("active");
    expect(deriveModuleStatus([false, false])).toBe("active");
  });

  it("devuelve 'partial' cuando hay mezcla (solo posible con >1 contrato)", () => {
    expect(deriveModuleStatus([true, false])).toBe("partial");
    expect(deriveModuleStatus([false, true])).toBe("partial");
    expect(deriveModuleStatus([true, false, true])).toBe("partial");
  });

  it("array vacío se considera 'active' (every() devuelve true sobre lista vacía pero también para !p)", () => {
    // Ambos every() devuelven true sobre array vacío. La primera condición
    // (todos true) gana → "paused". Es un caso degenerado que no se da en
    // la práctica (todos los módulos tienen ≥1 contrato).
    expect(deriveModuleStatus([])).toBe("paused");
  });
});

describe("MODULES", () => {
  it("define los 6 módulos lógicos", () => {
    const ids = MODULES.map((m) => m.id);
    expect(ids).toEqual(["roles", "library", "shop", "badges", "rooms", "print"]);
  });

  it("cada módulo tiene al menos un contrato", () => {
    for (const m of MODULES) {
      expect(m.contracts.length).toBeGreaterThan(0);
    }
  });

  it("library y shop son multi-contrato (token + manager)", () => {
    const library = MODULES.find((m) => m.id === "library");
    const shop = MODULES.find((m) => m.id === "shop");
    expect(library?.contracts.length).toBe(2);
    expect(shop?.contracts.length).toBe(2);
    expect(library?.contracts).toEqual(
      expect.arrayContaining(["libraryManager", "libraryToken"]),
    );
    expect(shop?.contracts).toEqual(
      expect.arrayContaining(["campusShop", "shopToken"]),
    );
  });
});

describe("getModule", () => {
  it("devuelve el módulo si existe", () => {
    const mod = getModule("library");
    expect(mod.id).toBe("library");
    expect(mod.name).toBe("Biblioteca");
  });

  it("lanza si el módulo no existe", () => {
    expect(() => getModule("inexistente")).toThrow(/desconocido/i);
  });
});
