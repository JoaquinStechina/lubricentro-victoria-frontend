"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Producto, ProductoColumnKey } from "@/app/lib/productos";
import ColumnFilterHeader from "@/app/components/ColumnFilterHeader";
import HighlightText from "@/app/components/HighlightText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ApiResponse = {
  items: Producto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 50;

const EMPTY_COLUMN_FILTERS: Record<ProductoColumnKey, string> = {
  proveedor: "",
  marca: "",
  sku: "",
  descripcion: "",
  seccion: "",
  precioNeto: "",
  precioConIva: "",
  alicuotaIva: "",
  fechaVigencia: "",
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatPrecio(valor: number | null) {
  if (valor === null || valor === undefined) return "—";
  return currencyFormatter.format(valor);
}

export default function CatalogoView() {
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Debounce los campos de texto para no disparar un fetch por cada tecla.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedColumnFilters, setDebouncedColumnFilters] = useState(
    EMPTY_COLUMN_FILTERS
  );
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedColumnFilters(columnFilters);
    }, 300);
    return () => clearTimeout(id);
  }, [search, columnFilters]);

  function setColumnFilter(key: ProductoColumnKey, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  // Cualquier cambio de filtro vuelve a la página 1 (ajuste de estado durante
  // el render, ver https://react.dev/learn/you-might-not-need-an-effect).
  const filterKey = `${debouncedSearch}|${JSON.stringify(debouncedColumnFilters)}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    for (const [key, value] of Object.entries(debouncedColumnFilters)) {
      if (value) params.set(`f_${key}`, value);
    }
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/productos?${params.toString()}`);
        const json: ApiResponse = await res.json();
        if (active) {
          setData(json);
          setExpandedRow(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [debouncedSearch, debouncedColumnFilters, page]);

  const hayFiltrosActivos =
    search || Object.values(columnFilters).some((v) => v);

  function limpiarFiltros() {
    setSearch("");
    setColumnFilters(EMPTY_COLUMN_FILTERS);
  }

  const rangoResultados = useMemo(() => {
    if (!data || data.total === 0) return "0 resultados";
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    return `${start}–${end} de ${data.total.toLocaleString("es-AR")}`;
  }, [data]);

  return (
    <>
      <section className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1 text-sm">
            <Label htmlFor="catalogo-search" className="text-zinc-600 dark:text-zinc-400">
              Buscar en todos los campos
            </Label>
            <Input
              id="catalogo-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej: 2351, filtro de aceite, Bosch, Vigencia..."
            />
          </div>

          {hayFiltrosActivos && (
            <Button variant="outline" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </section>

      <div className="mb-2 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>{loading ? "Cargando…" : rangoResultados}</span>
        {data && data.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
            >
              Anterior
            </Button>
            <span>
              Página {data.page} de {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={data.page >= data.totalPages}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <ColumnFilterHeader
                label="Proveedor"
                value={columnFilters.proveedor}
                onChange={(v) => setColumnFilter("proveedor", v)}
              />
              <ColumnFilterHeader
                label="Marca"
                value={columnFilters.marca}
                onChange={(v) => setColumnFilter("marca", v)}
              />
              <ColumnFilterHeader
                label="SKU interno"
                value={columnFilters.sku}
                onChange={(v) => setColumnFilter("sku", v)}
              />
              <ColumnFilterHeader
                label="Descripción"
                value={columnFilters.descripcion}
                onChange={(v) => setColumnFilter("descripcion", v)}
              />
              <ColumnFilterHeader
                label="Sección"
                value={columnFilters.seccion}
                onChange={(v) => setColumnFilter("seccion", v)}
              />
              <ColumnFilterHeader
                label="Precio neto"
                value={columnFilters.precioNeto}
                onChange={(v) => setColumnFilter("precioNeto", v)}
                align="right"
              />
              <ColumnFilterHeader
                label="Precio c/IVA"
                value={columnFilters.precioConIva}
                onChange={(v) => setColumnFilter("precioConIva", v)}
                align="right"
              />
              <ColumnFilterHeader
                label="IVA %"
                value={columnFilters.alicuotaIva}
                onChange={(v) => setColumnFilter("alicuotaIva", v)}
                align="right"
              />
              <ColumnFilterHeader
                label="Vigencia"
                value={columnFilters.fechaVigencia}
                onChange={(v) => setColumnFilter("fechaVigencia", v)}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && data && data.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center whitespace-normal text-zinc-500 dark:text-zinc-400"
                >
                  No se encontraron productos con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((producto, idx) => {
              const isExpanded = expandedRow === idx;
              const hasRawData =
                producto.raw_data && Object.keys(producto.raw_data).length > 0;
              return (
                <Fragment key={`${producto.sku_interno ?? "s"}-${idx}`}>
                  <TableRow
                    onClick={() =>
                      hasRawData && setExpandedRow(isExpanded ? null : idx)
                    }
                    className={hasRawData ? "cursor-pointer" : ""}
                  >
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={producto.proveedor} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={producto.marca ?? "—"} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      <HighlightText
                        text={producto.sku_interno ?? producto.sku_proveedor ?? "—"}
                        query={debouncedSearch}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal text-zinc-900 dark:text-zinc-100">
                      <HighlightText
                        text={producto.descripcion ?? "—"}
                        query={debouncedSearch}
                      />
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={producto.seccion ?? "—"} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                      <HighlightText
                        text={formatPrecio(producto.precio_neto)}
                        query={debouncedSearch}
                      />
                    </TableCell>
                    <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                      <HighlightText
                        text={formatPrecio(producto.precio_con_iva)}
                        query={debouncedSearch}
                      />
                    </TableCell>
                    <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                      <HighlightText
                        text={producto.alicuota_iva !== null ? String(producto.alicuota_iva) : "—"}
                        query={debouncedSearch}
                      />
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      <HighlightText
                        text={producto.fecha_vigencia ?? "—"}
                        query={debouncedSearch}
                      />
                    </TableCell>
                  </TableRow>
                  {isExpanded && hasRawData && (
                    <TableRow className="bg-zinc-50 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-950">
                      <TableCell colSpan={9} className="whitespace-normal py-3">
                        <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Columnas originales no mapeadas al schema canónico
                          (raw_data):
                        </p>
                        <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                          {JSON.stringify(producto.raw_data, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
