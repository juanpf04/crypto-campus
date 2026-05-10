import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aplica aria-label = placeholder por defecto", () => {
    render(<SearchInput placeholder="Buscar libros" onSearch={() => {}} />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("aria-label", "Buscar libros");
  });

  it("usa ariaLabel custom cuando se pasa", () => {
    render(
      <SearchInput
        placeholder="..."
        ariaLabel="Filtrar por nombre"
        onSearch={() => {}}
      />,
    );
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "aria-label",
      "Filtrar por nombre",
    );
  });

  it("debounce: solo dispara onSearch tras el delay", () => {
    const onSearch = vi.fn();

    render(<SearchInput onSearch={onSearch} debounceMs={300} />);
    const input = screen.getByRole("searchbox");

    fireEvent.change(input, { target: { value: "abc" } });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith("abc");
  });

  it("hace trim del valor antes de llamar a onSearch", () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} debounceMs={100} />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "  hola  " },
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(onSearch).toHaveBeenCalledWith("hola");
  });
});
