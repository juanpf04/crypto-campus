import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renderiza el título", () => {
    render(<EmptyState title="Sin resultados" />);
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("renderiza descripción cuando se pasa", () => {
    render(<EmptyState title="Vacío" description="Aún no has añadido nada" />);
    expect(screen.getByText("Aún no has añadido nada")).toBeInTheDocument();
  });

  it("no renderiza descripción cuando no se pasa", () => {
    const { container } = render(<EmptyState title="Vacío" />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renderiza la acción cuando se pasa", () => {
    render(
      <EmptyState
        title="Vacío"
        action={<button type="button">Añadir</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Añadir" })).toBeInTheDocument();
  });
});
