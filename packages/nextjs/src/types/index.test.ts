import { describe, it, expect } from "vitest";
import {
  resolveRoleRoute,
  ROLE_FOLDER_BY_USER_ROLE,
  ROUTE_ACCESS_BY_SECTION,
} from "./index";

describe("ROLE_FOLDER_BY_USER_ROLE", () => {
  it("mapea cada rol a su carpeta", () => {
    expect(ROLE_FOLDER_BY_USER_ROLE.STUDENT).toBe("student");
    expect(ROLE_FOLDER_BY_USER_ROLE.PROFESSOR).toBe("professor");
    expect(ROLE_FOLDER_BY_USER_ROLE.LIBRARIAN).toBe("librarian");
    expect(ROLE_FOLDER_BY_USER_ROLE.ADMIN).toBe("admin");
  });
});

describe("ROUTE_ACCESS_BY_SECTION", () => {
  it("library accesible por STUDENT, LIBRARIAN, ADMIN", () => {
    expect(ROUTE_ACCESS_BY_SECTION.library).toEqual(
      expect.arrayContaining(["STUDENT", "LIBRARIAN", "ADMIN"]),
    );
    expect(ROUTE_ACCESS_BY_SECTION.library).not.toContain("PROFESSOR");
  });

  it("badges accesible por STUDENT, PROFESSOR, ADMIN", () => {
    expect(ROUTE_ACCESS_BY_SECTION.badges).toEqual(
      expect.arrayContaining(["STUDENT", "PROFESSOR", "ADMIN"]),
    );
    expect(ROUTE_ACCESS_BY_SECTION.badges).not.toContain("LIBRARIAN");
  });

  it("shop accesible solo por STUDENT y ADMIN", () => {
    expect(ROUTE_ACCESS_BY_SECTION.shop).toEqual(["STUDENT", "ADMIN"]);
  });
});

describe("resolveRoleRoute", () => {
  it("devuelve dashboard del rol cuando returnUrl es null", () => {
    expect(resolveRoleRoute(null, "STUDENT")).toBe("/student");
    expect(resolveRoleRoute(undefined, "ADMIN")).toBe("/admin");
  });

  it("resuelve genérico /printing al path real por rol", () => {
    expect(resolveRoleRoute("/printing", "STUDENT")).toBe(
      "/student/library/printing",
    );
    expect(resolveRoleRoute("/printing", "LIBRARIAN")).toBe(
      "/librarian/printing",
    );
    expect(resolveRoleRoute("/printing", "ADMIN")).toBe("/admin/printing");
  });

  it("resuelve /badges según rol", () => {
    expect(resolveRoleRoute("/badges", "STUDENT")).toBe("/student/badges");
    expect(resolveRoleRoute("/badges", "PROFESSOR")).toBe("/professor/badges");
    expect(resolveRoleRoute("/badges", "ADMIN")).toBe("/admin/badges");
  });

  it("hace fallback al dashboard si el rol no tiene acceso", () => {
    // Profesor no tiene acceso a library
    expect(resolveRoleRoute("/library", "PROFESSOR")).toBe("/professor");
    // Librarian no tiene acceso a badges
    expect(resolveRoleRoute("/badges", "LIBRARIAN")).toBe("/librarian");
  });

  it("respeta paths que ya incluyen carpeta de rol", () => {
    expect(resolveRoleRoute("/student/shop", "STUDENT")).toBe("/student/shop");
  });

  it("preserva segmentos extra", () => {
    expect(resolveRoleRoute("/shop/cart", "STUDENT")).toBe(
      "/student/shop/cart",
    );
  });

  it("ignora query string en returnUrl", () => {
    expect(resolveRoleRoute("/shop?from=login", "STUDENT")).toBe(
      "/student/shop",
    );
  });
});
