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
import type { AuthUser } from "@/types";

interface MeResponse {
  user?: AuthUser;
  error?: string;
}

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as MeResponse;

        if (cancelled) return;

        if (!res.ok) {
          setUser(null);
          setError(data.error ?? "No se pudo obtener el usuario autenticado");
          return;
        }

        setUser(data.user ?? null);
        setError(null);
      } catch {
        if (!cancelled) {
          setUser(null);
          setError("Error de red al obtener el usuario autenticado");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAuthUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, error };
}
