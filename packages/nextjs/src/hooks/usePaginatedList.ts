"use client";

/**
 * usePaginatedList — Hook genérico para listados paginados.
 *
 * Encapsula el patrón repetido en ~18 pages del proyecto:
 *   useState(offset/items/total/loading) + useEffect + fetch + filtros + refresh
 *
 * Uso típico:
 *   const list = usePaginatedList<Item>({
 *     endpoint: "/api/library/items",
 *     filters: { type: typeFilter },  // valores null/undefined/"" se ignoran
 *   });
 *   ...
 *   <Pagination offset={list.offset} limit={list.limit} total={list.total} onChange={list.setOffset} />
 *
 * Al cambiar los filtros, el offset se resetea a 0 automáticamente.
 *
 * Acepta dos shapes de respuesta:
 *   - `{ items: T[], total: number }` (canónico del proyecto)
 *   - `T[]` (array directo; `total = items.length`)
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type FilterValue = string | number | boolean | null | undefined;

export interface UsePaginatedListOptions<T = unknown> {
  endpoint: string;
  pageSize?: number;
  filters?: Record<string, FilterValue>;
  enabled?: boolean;
  /** Se invoca una vez por cada error de fetch (p.ej. para lanzar un toast). */
  onError?: (message: string) => void;
  /**
   * Escape hatch para endpoints que no devuelven `{items, total}` ni un array:
   * parsea la respuesta cruda y devuelve la tupla estándar.
   */
  parseResponse?: (data: unknown, offset: number, limit: number) => { items: T[]; total: number };
}

export interface UsePaginatedListResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: string | null;
  offset: number;
  limit: number;
  setOffset: (newOffset: number) => void;
  refresh: () => Promise<void>;
}

function buildQuery(
  endpoint: string,
  offset: number,
  limit: number,
  filters?: Record<string, FilterValue>,
): string {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
  }
  return `${endpoint}?${params.toString()}`;
}

export function usePaginatedList<T>({
  endpoint,
  pageSize = 20,
  filters,
  enabled = true,
  onError,
  parseResponse,
}: UsePaginatedListOptions<T>): UsePaginatedListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs estables para callbacks: permiten al caller pasar callbacks inline
  // sin invalidar `refresh` en cada render.
  const onErrorRef = useRef(onError);
  const parseResponseRef = useRef(parseResponse);
  useEffect(() => {
    onErrorRef.current = onError;
    parseResponseRef.current = parseResponse;
  }, [onError, parseResponse]);

  // Stable key que sirve de dep para los effects: evita que objetos de filtros
  // recreados en cada render disparen fetches infinitos.
  const filtersKey = filters ? JSON.stringify(filters) : "";

  // Al cambiar los filtros, resetear offset a 0.
  useEffect(() => {
    setOffset(0);
  }, [filtersKey]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildQuery(endpoint, offset, pageSize, filters));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al cargar");
      }
      const data = await res.json();
      const customParser = parseResponseRef.current;
      if (customParser) {
        const parsed = customParser(data, offset, pageSize);
        setItems(parsed.items);
        setTotal(parsed.total);
      } else if (Array.isArray(data)) {
        setItems(data as T[]);
        setTotal(data.length);
      } else {
        setItems((data.items as T[]) ?? []);
        setTotal(data.total ?? (data.items?.length ?? 0));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar";
      setError(message);
      setItems([]);
      setTotal(0);
      onErrorRef.current?.(message);
    } finally {
      setLoading(false);
    }
    // filtersKey se usa en lugar de filters para tener una dep estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, pageSize, offset, enabled, filtersKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    items,
    total,
    loading,
    error,
    offset,
    limit: pageSize,
    setOffset,
    refresh,
  };
}
