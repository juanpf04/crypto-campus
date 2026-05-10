import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renderiza el children", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("llama a onClick al pulsarse", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("queda deshabilitado y no llama a onClick si loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Cargando
      </Button>,
    );

    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();

    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("queda deshabilitado y no llama a onClick si disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );

    expect(screen.getByRole("button")).toBeDisabled();
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("respeta type=submit", () => {
    render(<Button type="submit">Enviar</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
