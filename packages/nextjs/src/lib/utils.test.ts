import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("une strings simples", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("ignora valores falsy", () => {
    expect(cn("px-4", false && "hidden", undefined, null)).toBe("px-4");
  });

  it("aplica condicionales con objeto", () => {
    expect(cn("base", { "text-red-500": true, "hidden": false })).toBe(
      "base text-red-500",
    );
  });

  it("resuelve conflictos Tailwind (la última gana)", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
    expect(cn("text-sm text-base")).toBe("text-base");
  });

  it("permite sobreescribir desde className externo", () => {
    expect(cn("bg-primary", "bg-secondary")).toBe("bg-secondary");
  });
});
