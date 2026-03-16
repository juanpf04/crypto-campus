"use client";

/**
 * Hook que obtiene los datos del usuario autenticado desde /api/auth/me.
 *
 * Centraliza el patrón fetch + estado + loading que se repetía
 * en los 4 dashboards, el redirector y la lista de usuarios.
 *
 * Devuelve:
 * - user: datos del usuario (null mientras carga)
 * - loading: true mientras la petición está en curso
 */

import { useEffect, useState } from "react";

interface AuthUser {
  name: string;
  role: string;
  email: string;
}

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
