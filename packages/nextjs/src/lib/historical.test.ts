import { describe, it, expect } from "vitest";
import { ensureNotHistorical, ensureOnChainId, ONLY_LIVE } from "./historical";

describe("ONLY_LIVE", () => {
  it("es un filtro Prisma con historical=false", () => {
    expect(ONLY_LIVE).toEqual({ historical: false });
  });
});

describe("ensureNotHistorical", () => {
  it("no lanza si la entidad es null/undefined", () => {
    expect(() => ensureNotHistorical(null)).not.toThrow();
    expect(() => ensureNotHistorical(undefined)).not.toThrow();
  });

  it("no lanza si la entidad no es histórica", () => {
    expect(() => ensureNotHistorical({ historical: false })).not.toThrow();
    expect(() => ensureNotHistorical({})).not.toThrow();
  });

  it("lanza con mensaje en español si la entidad es histórica", () => {
    expect(() =>
      ensureNotHistorical({ historical: true }, "Préstamo"),
    ).toThrow(/histórico/i);
  });
});

interface LoanLike {
  historical?: boolean;
  loanId: number | null;
}

describe("ensureOnChainId", () => {
  it("lanza si la entidad es null", () => {
    expect(() =>
      ensureOnChainId<LoanLike, "loanId">(null, "loanId", "Préstamo"),
    ).toThrow(/no encontrado/i);
  });

  it("lanza si la entidad es histórica", () => {
    expect(() =>
      ensureOnChainId(
        { historical: true, loanId: 5 },
        "loanId",
        "Préstamo",
      ),
    ).toThrow(/histórico/i);
  });

  it("lanza si el id on-chain es null", () => {
    expect(() =>
      ensureOnChainId(
        { historical: false, loanId: null as number | null },
        "loanId",
        "Préstamo",
      ),
    ).toThrow(/sin id on-chain/i);
  });

  it("no lanza con id válido", () => {
    expect(() =>
      ensureOnChainId(
        { historical: false, loanId: 7 },
        "loanId",
        "Préstamo",
      ),
    ).not.toThrow();
  });
});
