"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { Oferta } from "@/app/lib/ofertas";

type ApiResponse = {
  items: Oferta[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  marcas: string[];
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filterKey = `${marca}|${debouncedSearch}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (marca) params.set("marca", marca);
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
  }, [marca, debouncedSearch, page]);

  const marcasDisponibles = data?.marcas ?? [];

  const rangoResultados = useMemo(() => {
    if (!data || data.total === 0) return "0 resultados";
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    return `${start}–${end} de ${data.total.toLocaleString("es-AR")}`;
  }, [data]);

  return (
    <>
      <section className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end sm:gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Marca</span>
          <select
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">Todas</option>
            {marcasDisponibles.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-[2] flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            Buscar por SKU o descripción
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: 65/0001, S4 36 DA..."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>
      </section>

      <div className="mb-2 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>{loading ? "Cargando…" : rangoResultados}</span>
        {data && data.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
            >
              Anterior
            </button>
            <span>
              Página {data.page} de {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={data.page >= data.totalPages}
              className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Marca</th>
              <th className="px-4 py-3">N° oferta</th>
              <th className="px-4 py-3">SKU proveedor</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3 text-right">Desde cant.</th>
              <th className="px-4 py-3 text-right">Descuento</th>
              <th className="px-4 py-3 text-right">Precio unitario</th>
              <th className="px-4 py-3">Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {!loading && data && data.items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No se encontraron ofertas con esos filtros.
                </td>
              </tr>
            )}
            {data?.items.map((oferta) => {
              const isExpanded = expandedRow === oferta.id;
              return (
                <Fragment key={oferta.id}>
                  <tr
                    onClick={() =>
                      setExpandedRow(isExpanded ? null : oferta.id)
                    }
                    className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {oferta.marca}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {oferta.numero_oferta}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {oferta.sku_proveedor}
                    </td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                      {oferta.descripcion}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-zinc-700 dark:text-zinc-300">
                      {oferta.desde_cantidad}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-zinc-700 dark:text-zinc-300">
                      {oferta.descuento_pct}%
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-zinc-900 dark:text-zinc-100">
                      {formatPrecio(oferta.precio_unitario)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {oferta.fecha_oferta}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                      <td colSpan={8} className="px-4 py-3">
                        <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Fila original ({oferta.archivo_origen}, publicada a
                          las {oferta.hora_oferta}):
                        </p>
                        <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                          {JSON.stringify(oferta.raw_data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
