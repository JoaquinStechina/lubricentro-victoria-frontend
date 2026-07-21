"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import type { Oferta, OfertaColumnKey } from "@/app/lib/ofertas";
import { useSession } from "@/app/components/SessionProvider";
import ColumnFilterHeader from "@/app/components/ColumnFilterHeader";
import HighlightText from "@/app/components/HighlightText";
import EditarOfertaDialog from "@/app/components/ofertas/EditarOfertaDialog";
import BulkEditarOfertaDialog from "@/app/components/ofertas/BulkEditarOfertaDialog";
import EliminarOfertasDialog from "@/app/components/ofertas/EliminarOfertasDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ApiResponse = {
  ofertas: Oferta[];
};

const PAGE_SIZES = [50, 100, 200] as const;

const EMPTY_COLUMN_FILTERS: Record<OfertaColumnKey, string> = {
  marca: "",
  numeroOferta: "",
  sku: "",
  descripcion: "",
  desdeCantidad: "",
  descuentoPctMin: "",
  descuentoPctMax: "",
  precioUnitarioMin: "",
  precioUnitarioMax: "",
  fechaOferta: "",
  vigencia: "",
  fechaHasta: "",
};

type SortState = { campo: string; order: "asc" | "desc" } | null;

// "sin_fecha"/"con_fecha" en vez de comparar contra un valor de texto: null
// en fechaHasta no se puede buscar con un filtro "contains" (ver
// backend/src/routes/ofertas.ts f_vigencia).
const VIGENCIA_OPTIONS = [
  { value: "sin_fecha", label: "Hasta agotar stock" },
  { value: "con_fecha", label: "Con fecha de vencimiento" },
];

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatPrecio(valor: number) {
  return currencyFormatter.format(valor);
}

// El backend de ofertas no pagina (devuelve la lista completa filtrada por
// activa/eliminado); la paginación de 50 en 50 se hace acá en memoria, igual
// que hacía el prototipo JSON antes de migrar a la API real.
export default function OfertasView() {
  const session = useSession();
  const puedeEditar = session?.rol === "ADMINISTRADOR" || session?.rol === "SYSADMIN";

  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [sort, setSort] = useState<SortState>(null);
  const [allOfertas, setAllOfertas] = useState<Oferta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  function setColumnFilter(key: OfertaColumnKey, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  // El ciclo de orden por columna es asc → desc → sin orden; ordenar por
  // otra columna arranca de nuevo en asc.
  function toggleSort(campo: string) {
    setSort((prev) => {
      if (!prev || prev.campo !== campo) return { campo, order: "asc" };
      if (prev.order === "asc") return { campo, order: "desc" };
      return null;
    });
  }

  const filterKey = `${debouncedSearch}|${JSON.stringify(debouncedColumnFilters)}|${JSON.stringify(sort)}|${pageSize}`;
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
    if (sort) {
      params.set("sort", sort.campo);
      params.set("order", sort.order);
    }

    async function load() {
      setLoading(true);
      try {
        const json = await apiFetch<ApiResponse>(`/api/ofertas?${params.toString()}`);
        if (active) {
          setAllOfertas(json.ofertas);
          setExpandedRow(null);
          setSelectedIds(new Set());
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [debouncedSearch, debouncedColumnFilters, sort, reloadTick]);

  const hayFiltrosActivos =
    search || Object.values(columnFilters).some((v) => v);

  function limpiarFiltros() {
    setSearch("");
    setColumnFilters(EMPTY_COLUMN_FILTERS);
  }

  const total = allOfertas?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = useMemo(
    () => (allOfertas ?? []).slice((page - 1) * pageSize, page * pageSize),
    [allOfertas, page, pageSize]
  );

  const rangoResultados = useMemo(() => {
    if (total === 0) return "0 resultados";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}–${end} de ${total.toLocaleString("es-AR")}`;
  }, [total, page, pageSize]);

  const visibleIds = pageItems.map((o) => o.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selectedIds.has(id));

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds));
  }
  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedOferta =
    selectedIds.size === 1 ? (allOfertas?.find((o) => selectedIds.has(o.id)) ?? null) : null;

  function handleSingleUpdated(actualizada: Oferta) {
    setAllOfertas((prev) =>
      prev ? prev.map((o) => (o.id === actualizada.id ? actualizada : o)) : prev
    );
    setSelectedIds(new Set());
  }
  function handleBulkUpdated() {
    setSelectedIds(new Set());
    setReloadTick((t) => t + 1);
  }
  function handleDeleted(ids: number[]) {
    const eliminadas = new Set(ids);
    setAllOfertas((prev) => (prev ? prev.filter((o) => !eliminadas.has(o.id)) : prev));
    setSelectedIds(new Set());
  }

  const colSpan = puedeEditar ? 10 : 9;

  return (
    <>
      <section className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1 text-sm">
            <Label htmlFor="ofertas-search" className="text-zinc-600 dark:text-zinc-400">
              Buscar en todos los campos
            </Label>
            <Input
              id="ofertas-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej: 65/0001, S4 36 DA, Bosch..."
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
        <div className="flex items-center gap-3">
          {total > 0 && (
            <label className="flex items-center gap-1.5">
              <span className="text-xs">Filas por página</span>
              <Select
                items={Object.fromEntries(PAGE_SIZES.map((n) => [String(n), String(n)]))}
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </div>

      {puedeEditar && selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {selectedIds.size} seleccionada{selectedIds.size > 1 ? "s" : ""}
          </span>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Eliminar
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {puedeEditar && (
                <TableHead>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todo"
                  />
                </TableHead>
              )}
              <ColumnFilterHeader
                label="Marca"
                value={columnFilters.marca}
                onChange={(v) => setColumnFilter("marca", v)}
                sortDirection={sort?.campo === "marca" ? sort.order : null}
                onSortToggle={() => toggleSort("marca")}
              />
              <ColumnFilterHeader
                label="N° oferta"
                value={columnFilters.numeroOferta}
                onChange={(v) => setColumnFilter("numeroOferta", v)}
                sortDirection={sort?.campo === "numeroOferta" ? sort.order : null}
                onSortToggle={() => toggleSort("numeroOferta")}
              />
              <ColumnFilterHeader
                label="SKU proveedor"
                value={columnFilters.sku}
                onChange={(v) => setColumnFilter("sku", v)}
                sortDirection={sort?.campo === "sku" ? sort.order : null}
                onSortToggle={() => toggleSort("sku")}
              />
              <ColumnFilterHeader
                label="Descripción"
                value={columnFilters.descripcion}
                onChange={(v) => setColumnFilter("descripcion", v)}
                sortDirection={sort?.campo === "descripcion" ? sort.order : null}
                onSortToggle={() => toggleSort("descripcion")}
              />
              <ColumnFilterHeader
                label="Desde cant."
                value={columnFilters.desdeCantidad}
                onChange={(v) => setColumnFilter("desdeCantidad", v)}
                align="right"
                sortDirection={sort?.campo === "desdeCantidad" ? sort.order : null}
                onSortToggle={() => toggleSort("desdeCantidad")}
              />
              <ColumnFilterHeader
                label="Descuento"
                value=""
                onChange={() => {}}
                rangeValue={{ min: columnFilters.descuentoPctMin, max: columnFilters.descuentoPctMax }}
                onRangeChange={(min, max) =>
                  setColumnFilters((prev) => ({ ...prev, descuentoPctMin: min, descuentoPctMax: max }))
                }
                align="right"
                sortDirection={sort?.campo === "descuentoPct" ? sort.order : null}
                onSortToggle={() => toggleSort("descuentoPct")}
              />
              <ColumnFilterHeader
                label="Precio unitario"
                value=""
                onChange={() => {}}
                rangeValue={{
                  min: columnFilters.precioUnitarioMin,
                  max: columnFilters.precioUnitarioMax,
                }}
                onRangeChange={(min, max) =>
                  setColumnFilters((prev) => ({
                    ...prev,
                    precioUnitarioMin: min,
                    precioUnitarioMax: max,
                  }))
                }
                align="right"
                sortDirection={sort?.campo === "precioUnitario" ? sort.order : null}
                onSortToggle={() => toggleSort("precioUnitario")}
              />
              <ColumnFilterHeader
                label="Vigencia"
                value={columnFilters.fechaOferta}
                onChange={(v) => setColumnFilter("fechaOferta", v)}
                sortDirection={sort?.campo === "fechaOferta" ? sort.order : null}
                onSortToggle={() => toggleSort("fechaOferta")}
              />
              <ColumnFilterHeader
                label="Válida hasta"
                value={columnFilters.vigencia}
                onChange={(v) => setColumnFilter("vigencia", v)}
                options={VIGENCIA_OPTIONS}
                dateValue={columnFilters.fechaHasta}
                onDateChange={(v) => setColumnFilter("fechaHasta", v)}
                sortDirection={sort?.campo === "fechaHasta" ? sort.order : null}
                onSortToggle={() => toggleSort("fechaHasta")}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && pageItems.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="py-8 text-center whitespace-normal text-zinc-500 dark:text-zinc-400"
                >
                  No se encontraron ofertas con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {pageItems.map((oferta) => {
              const isExpanded = expandedRow === oferta.id;
              return (
                <Fragment key={oferta.id}>
                  <TableRow
                    onClick={() =>
                      setExpandedRow(isExpanded ? null : oferta.id)
                    }
                    className="cursor-pointer"
                  >
                    {puedeEditar && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(oferta.id)}
                          onCheckedChange={() => toggleRow(oferta.id)}
                          aria-label="Seleccionar fila"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={oferta.marca} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={String(oferta.numeroOferta)} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={oferta.skuProveedor} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="whitespace-normal text-zinc-900 dark:text-zinc-100">
                      <HighlightText text={oferta.descripcion} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={String(oferta.desdeCantidad)} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={`${oferta.descuentoPct}%`} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                      <HighlightText text={formatPrecio(oferta.precioUnitario)} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      <HighlightText text={oferta.fechaOferta} query={debouncedSearch} />
                    </TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">
                      {oferta.fechaHasta ?? (
                        <span className="text-zinc-500 dark:text-zinc-500">Hasta agotar stock</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-zinc-50 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-950">
                      <TableCell colSpan={colSpan} className="whitespace-normal py-3">
                        <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Fila original ({oferta.archivoOrigen}, publicada a
                          las {oferta.horaOferta}):
                        </p>
                        <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                          {JSON.stringify(oferta.rawData, null, 2)}
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

      {editOpen && selectedOferta && (
        <EditarOfertaDialog
          oferta={selectedOferta}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleSingleUpdated}
        />
      )}
      {editOpen && !selectedOferta && selectedIds.size > 1 && (
        <BulkEditarOfertaDialog
          ids={[...selectedIds]}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleBulkUpdated}
        />
      )}
      <EliminarOfertasDialog
        ids={[...selectedIds]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={handleDeleted}
      />
    </>
  );
}
