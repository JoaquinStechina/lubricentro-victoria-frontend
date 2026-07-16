"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Producto } from "@/app/lib/productos";
import ComboboxFilter from "@/app/components/ComboboxFilter";
import FilterSelect from "@/app/components/FilterSelect";
import HighlightText from "@/app/components/HighlightText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ApiResponse = {
  items: Producto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  proveedores: string[];
  marcas: string[];
  secciones: string[];
  fechasVigencia: string[];
  alicuotasIva: number[];
};

const PAGE_SIZE = 50;

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatPrecio(valor: number | null) {
  if (valor === null || valor === undefined) return "—";
  return currencyFormatter.format(valor);
}

export default function CatalogoView() {
  const [proveedor, setProveedor] = useState("");
  const [marca, setMarca] = useState("");
  const [seccion, setSeccion] = useState("");
  const [fechaVigencia, setFechaVigencia] = useState("");
  const [alicuotaIva, setAlicuotaIva] = useState("");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Debounce los campos de texto para no disparar un fetch por cada tecla.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedPrecioMin, setDebouncedPrecioMin] = useState("");
  const [debouncedPrecioMax, setDebouncedPrecioMax] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedPrecioMin(precioMin);
      setDebouncedPrecioMax(precioMax);
    }, 300);
    return () => clearTimeout(id);
  }, [search, precioMin, precioMax]);

  // Cualquier cambio de filtro vuelve a la página 1 (ajuste de estado durante
  // el render, ver https://react.dev/learn/you-might-not-need-an-effect).
  const filterKey = `${proveedor}|${marca}|${seccion}|${fechaVigencia}|${alicuotaIva}|${debouncedPrecioMin}|${debouncedPrecioMax}|${debouncedSearch}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (proveedor) params.set("proveedor", proveedor);
    if (marca) params.set("marca", marca);
    if (seccion) params.set("seccion", seccion);
    if (fechaVigencia) params.set("fechaVigencia", fechaVigencia);
    if (alicuotaIva) params.set("alicuotaIva", alicuotaIva);
    if (debouncedPrecioMin) params.set("precioMin", debouncedPrecioMin);
    if (debouncedPrecioMax) params.set("precioMax", debouncedPrecioMax);
    if (debouncedSearch) params.set("search", debouncedSearch);
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
  }, [
    proveedor,
    marca,
    seccion,
    fechaVigencia,
    alicuotaIva,
    debouncedPrecioMin,
    debouncedPrecioMax,
    debouncedSearch,
    page,
  ]);

  const marcasDisponibles = data?.marcas ?? [];
  const proveedoresDisponibles = data?.proveedores ?? [];
  const seccionesDisponibles = data?.secciones ?? [];
  const fechasVigenciaDisponibles = data?.fechasVigencia ?? [];
  const alicuotasIvaDisponibles = (data?.alicuotasIva ?? []).map((a) =>
    String(a)
  );

  const hayFiltrosActivos =
    proveedor ||
    marca ||
    seccion ||
    fechaVigencia ||
    alicuotaIva ||
    precioMin ||
    precioMax ||
    search;

  function limpiarFiltros() {
    setProveedor("");
    setMarca("");
    setSeccion("");
    setFechaVigencia("");
    setAlicuotaIva("");
    setPrecioMin("");
    setPrecioMax("");
    setSearch("");
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect
            label="Proveedor"
            value={proveedor}
            onChange={(next) => {
              setProveedor(next);
              setMarca("");
            }}
            options={proveedoresDisponibles}
            allLabel="Todos"
          />

          <FilterSelect
            label="Marca"
            value={marca}
            onChange={setMarca}
            options={marcasDisponibles}
            allLabel="Todas"
          />

          <ComboboxFilter
            label="Sección"
            value={seccion}
            onChange={setSeccion}
            options={seccionesDisponibles}
            allLabel="Todas"
            searchPlaceholder="Buscar sección..."
          />

          <FilterSelect
            label="Vigencia"
            value={fechaVigencia}
            onChange={setFechaVigencia}
            options={fechasVigenciaDisponibles}
            allLabel="Todas"
          />

          <FilterSelect
            label="IVA"
            value={alicuotaIva}
            onChange={setAlicuotaIva}
            options={alicuotasIvaDisponibles}
            allLabel="Todas"
          />

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Precio neto ($)
            </span>
            <div className="flex gap-1">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={precioMin}
                onChange={(e) => setPrecioMin(e.target.value)}
                placeholder="Mín"
                className="w-1/2"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={precioMax}
                onChange={(e) => setPrecioMax(e.target.value)}
                placeholder="Máx"
                className="w-1/2"
              />
            </div>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1 text-sm">
            <Label htmlFor="catalogo-search" className="text-zinc-600 dark:text-zinc-400">
              Buscar por SKU o descripción
            </Label>
            <Input
              id="catalogo-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej: 2351, filtro de aceite..."
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
              <TableHead>Proveedor</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>SKU interno</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Sección</TableHead>
              <TableHead className="text-right">Precio neto</TableHead>
              <TableHead className="text-right">Precio c/IVA</TableHead>
              <TableHead className="text-right">IVA %</TableHead>
              <TableHead>Vigencia</TableHead>
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
                      {producto.proveedor}
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      {producto.marca ?? "—"}
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
                      {hasRawData && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        >
                          +datos sin mapear
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      {producto.seccion ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                      {formatPrecio(producto.precio_neto)}
                    </TableCell>
                    <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                      {formatPrecio(producto.precio_con_iva)}
                    </TableCell>
                    <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                      {producto.alicuota_iva ?? "—"}
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      {producto.fecha_vigencia ?? "—"}
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
