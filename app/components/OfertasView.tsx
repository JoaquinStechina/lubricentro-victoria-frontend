"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Oferta } from "@/app/lib/ofertas";
import FilterSelect from "@/app/components/FilterSelect";
import HighlightText from "@/app/components/HighlightText";
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
  items: Oferta[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  marcas: string[];
  fechasOferta: string[];
};

const PAGE_SIZE = 50;

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatPrecio(valor: number) {
  return currencyFormatter.format(valor);
}

export default function OfertasView() {
  const [marca, setMarca] = useState("");
  const [fechaOferta, setFechaOferta] = useState("");
  const [descuentoMin, setDescuentoMin] = useState("");
  const [descuentoMax, setDescuentoMax] = useState("");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedDescuentoMin, setDebouncedDescuentoMin] = useState("");
  const [debouncedDescuentoMax, setDebouncedDescuentoMax] = useState("");
  const [debouncedPrecioMin, setDebouncedPrecioMin] = useState("");
  const [debouncedPrecioMax, setDebouncedPrecioMax] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedDescuentoMin(descuentoMin);
      setDebouncedDescuentoMax(descuentoMax);
      setDebouncedPrecioMin(precioMin);
      setDebouncedPrecioMax(precioMax);
    }, 300);
    return () => clearTimeout(id);
  }, [search, descuentoMin, descuentoMax, precioMin, precioMax]);

  const filterKey = `${marca}|${fechaOferta}|${debouncedDescuentoMin}|${debouncedDescuentoMax}|${debouncedPrecioMin}|${debouncedPrecioMax}|${debouncedSearch}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (marca) params.set("marca", marca);
    if (fechaOferta) params.set("fechaOferta", fechaOferta);
    if (debouncedDescuentoMin) params.set("descuentoMin", debouncedDescuentoMin);
    if (debouncedDescuentoMax) params.set("descuentoMax", debouncedDescuentoMax);
    if (debouncedPrecioMin) params.set("precioMin", debouncedPrecioMin);
    if (debouncedPrecioMax) params.set("precioMax", debouncedPrecioMax);
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ofertas?${params.toString()}`);
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
    marca,
    fechaOferta,
    debouncedDescuentoMin,
    debouncedDescuentoMax,
    debouncedPrecioMin,
    debouncedPrecioMax,
    debouncedSearch,
    page,
  ]);

  const marcasDisponibles = data?.marcas ?? [];
  const fechasOfertaDisponibles = data?.fechasOferta ?? [];

  const hayFiltrosActivos =
    marca ||
    fechaOferta ||
    descuentoMin ||
    descuentoMax ||
    precioMin ||
    precioMax ||
    search;

  function limpiarFiltros() {
    setMarca("");
    setFechaOferta("");
    setDescuentoMin("");
    setDescuentoMax("");
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FilterSelect
            label="Marca"
            value={marca}
            onChange={setMarca}
            options={marcasDisponibles}
            allLabel="Todas"
          />

          <FilterSelect
            label="Fecha de oferta"
            value={fechaOferta}
            onChange={setFechaOferta}
            options={fechasOfertaDisponibles}
            allLabel="Todas"
          />

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Descuento (%)
            </span>
            <div className="flex gap-1">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={descuentoMin}
                onChange={(e) => setDescuentoMin(e.target.value)}
                placeholder="Mín"
                className="w-1/2"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={descuentoMax}
                onChange={(e) => setDescuentoMax(e.target.value)}
                placeholder="Máx"
                className="w-1/2"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Precio unitario ($)
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
            <Label htmlFor="ofertas-search" className="text-zinc-600 dark:text-zinc-400">
              Buscar por SKU o descripción
            </Label>
            <Input
              id="ofertas-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej: 65/0001, S4 36 DA..."
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
              <TableHead>Marca</TableHead>
              <TableHead>N° oferta</TableHead>
              <TableHead>SKU proveedor</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Desde cant.</TableHead>
              <TableHead className="text-right">Descuento</TableHead>
              <TableHead className="text-right">Precio unitario</TableHead>
              <TableHead>Vigencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && data && data.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center whitespace-normal text-zinc-500 dark:text-zinc-400"
                >
                  No se encontraron ofertas con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((oferta) => {
              const isExpanded = expandedRow === oferta.id;
              return (
                <Fragment key={oferta.id}>
                  <TableRow
                    onClick={() =>
                      setExpandedRow(isExpanded ? null : oferta.id)
                    }
                    className="cursor-pointer"
                  >
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      {oferta.marca}
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      {oferta.numero_oferta}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={oferta.sku_proveedor} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="whitespace-normal text-zinc-900 dark:text-zinc-100">
                      <HighlightText text={oferta.descripcion} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                      {oferta.desde_cantidad}
                    </TableCell>
                    <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                      {oferta.descuento_pct}%
                    </TableCell>
                    <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                      {formatPrecio(oferta.precio_unitario)}
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      {oferta.fecha_oferta}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-zinc-50 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-950">
                      <TableCell colSpan={8} className="whitespace-normal py-3">
                        <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Fila original ({oferta.archivo_origen}, publicada a
                          las {oferta.hora_oferta}):
                        </p>
                        <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                          {JSON.stringify(oferta.raw_data, null, 2)}
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
