"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type SortState = { campo: string; order: "asc" | "desc" } | null;

// Estado de tabla compartido por Catálogo, Ofertas y Stock: búsqueda con
// debounce, filtros por columna, orden ciclado, paginación, selección de
// filas y papelera. Lo que NO vive acá (a propósito) es todo lo propio de
// cada recurso: definición de columnas, formato de celdas, diálogos y
// acciones en lote.
export function useTablaRecurso<TFilters extends Record<string, string>>(opciones: {
  filtrosIniciales: TFilters;
  pageSizeInicial: number;
}) {
  const { filtrosIniciales, pageSizeInicial } = opciones;

  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<TFilters>(filtrosIniciales);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(pageSizeInicial);
  const [sort, setSort] = useState<SortState>(null);
  const [verEliminados, setVerEliminados] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // Se incrementa para forzar un refetch después de mutar (alta, edición,
  // movimiento) sin tener que tocar los filtros.
  const [reloadTick, setReloadTick] = useState(0);

  // Debounce de los campos de texto: sin esto se dispara un fetch por tecla.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedColumnFilters, setDebouncedColumnFilters] = useState<TFilters>(filtrosIniciales);
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedColumnFilters(columnFilters);
    }, 300);
    return () => clearTimeout(id);
  }, [search, columnFilters]);

  const setColumnFilter = useCallback((key: keyof TFilters, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setSearch("");
    setColumnFilters(filtrosIniciales);
  }, [filtrosIniciales]);

  const hayFiltrosActivos = Boolean(search) || Object.values(columnFilters).some((v) => v);

  // Ciclo de orden: asc -> desc -> sin orden. Ordenar por otra columna
  // arranca de nuevo en asc.
  const toggleSort = useCallback((campo: string) => {
    setSort((prev) => {
      if (!prev || prev.campo !== campo) return { campo, order: "asc" };
      if (prev.order === "asc") return { campo, order: "desc" };
      return null;
    });
  }, []);

  // Cualquier cambio de filtro/orden/tamaño vuelve a página 1. Es un ajuste
  // de estado durante el render, no un efecto:
  // https://react.dev/learn/you-might-not-need-an-effect
  const filterKey = `${debouncedSearch}|${JSON.stringify(debouncedColumnFilters)}|${JSON.stringify(sort)}|${pageSize}|${verEliminados}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const toggleRow = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: number[], seleccionarTodo: boolean) => {
    setSelectedIds(seleccionarTodo ? new Set(ids) : new Set());
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const recargar = useCallback(() => setReloadTick((t) => t + 1), []);

  // Query params comunes. `incluirPaginado: false` es lo que usa el export,
  // que baja el resultado completo con los mismos filtros y orden.
  const buildParams = useCallback(
    (incluirPaginado: boolean) => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      for (const [key, value] of Object.entries(debouncedColumnFilters)) {
        if (value) params.set(`f_${key}`, value);
      }
      if (sort) {
        params.set("sort", sort.campo);
        params.set("order", sort.order);
      }
      if (verEliminados) params.set("incluirEliminados", "true");
      if (incluirPaginado) {
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
      }
      return params;
    },
    [debouncedSearch, debouncedColumnFilters, sort, verEliminados, page, pageSize]
  );

  // Clave de dependencias para el useEffect de fetch de cada vista.
  const fetchKey = useMemo(
    () => `${filterKey}|${page}|${reloadTick}`,
    [filterKey, page, reloadTick]
  );

  return {
    search,
    setSearch,
    columnFilters,
    setColumnFilter,
    limpiarFiltros,
    hayFiltrosActivos,
    page,
    setPage,
    pageSize,
    setPageSize,
    sort,
    toggleSort,
    verEliminados,
    setVerEliminados,
    selectedIds,
    setSelectedIds,
    toggleRow,
    toggleAll,
    clearSelection,
    buildParams,
    fetchKey,
    recargar,
  };
}
