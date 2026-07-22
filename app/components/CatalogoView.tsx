"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { History, ImageIcon, Plus } from "lucide-react";
import { apiFetch, apiJsonInit, imagenSrc } from "@/app/lib/api";
import type { Producto, ProductoColumnKey } from "@/app/lib/productos";
import { useColumnPrefs } from "@/app/lib/useColumnPrefs";
import { useSession } from "@/app/components/SessionProvider";
import ColumnFilterHeader from "@/app/components/ColumnFilterHeader";
import ColumnVisibilityMenu, { type ColumnOption } from "@/app/components/ColumnVisibilityMenu";
import ExportarButton from "@/app/components/ExportarButton";
import HighlightText from "@/app/components/HighlightText";
import TablePaginationBar from "@/app/components/TablePaginationBar";
import EditarProductoDialog from "@/app/components/catalogo/EditarProductoDialog";
import NuevoProductoDialog from "@/app/components/catalogo/NuevoProductoDialog";
import BulkEditarProductoDialog from "@/app/components/catalogo/BulkEditarProductoDialog";
import EliminarProductosDialog from "@/app/components/catalogo/EliminarProductosDialog";
import HistorialProductoDialog from "@/app/components/catalogo/HistorialProductoDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
};

const PAGE_SIZES = [50, 100, 200] as const;

// Ver mismo criterio en OfertasView.tsx: checkbox/miniatura/historial son
// estructurales y no entran acá.
const CATALOGO_COLUMN_OPTIONS: ColumnOption[] = [
  { key: "proveedor", label: "Proveedor" },
  { key: "marca", label: "Marca" },
  { key: "sku", label: "SKU interno" },
  { key: "descripcion", label: "Descripción" },
  { key: "seccion", label: "Sección" },
  { key: "precioNeto", label: "Precio neto" },
  { key: "precioConIva", label: "Precio c/IVA" },
  { key: "alicuotaIva", label: "IVA %" },
  { key: "fechaVigencia", label: "Vigencia" },
];
const CATALOGO_DEFAULT_COLUMN_ORDER = CATALOGO_COLUMN_OPTIONS.map((c) => c.key);

const EMPTY_COLUMN_FILTERS: Record<ProductoColumnKey, string> = {
  proveedor: "",
  marca: "",
  sku: "",
  descripcion: "",
  seccion: "",
  precioNetoMin: "",
  precioNetoMax: "",
  precioConIvaMin: "",
  precioConIvaMax: "",
  alicuotaIva: "",
  fechaVigencia: "",
};

type SortState = { campo: string; order: "asc" | "desc" } | null;

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatPrecio(valor: number | null) {
  if (valor === null || valor === undefined) return "—";
  return currencyFormatter.format(valor);
}

export default function CatalogoView() {
  const session = useSession();
  const puedeEditar = session?.rol === "ADMINISTRADOR" || session?.rol === "SYSADMIN";

  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [sort, setSort] = useState<SortState>(null);
  const [verEliminados, setVerEliminados] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Valores para el combobox del filtro de Sección; si el fetch falla el
  // filtro simplemente queda vacío (se puede seguir usando el resto).
  const [secciones, setSecciones] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    apiFetch<(string | null)[]>("/api/productos/secciones")
      .then((data) => {
        if (active) setSecciones(data.filter((s): s is string => s !== null && s !== ""));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [historialProducto, setHistorialProducto] = useState<Producto | null>(null);

  const {
    order: columnOrder,
    hidden: hiddenColumns,
    setOrder: setColumnOrder,
    toggleColumn,
    reset: resetColumnPrefs,
  } = useColumnPrefs("lv:columnas:catalogo", CATALOGO_DEFAULT_COLUMN_ORDER);

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

  // El ciclo de orden por columna es asc → desc → sin orden; ordenar por
  // otra columna arranca de nuevo en asc.
  function toggleSort(campo: string) {
    setSort((prev) => {
      if (!prev || prev.campo !== campo) return { campo, order: "asc" };
      if (prev.order === "asc") return { campo, order: "desc" };
      return null;
    });
  }

  // Cualquier cambio de filtro/orden/tamaño vuelve a la página 1 (ajuste de
  // estado durante el render, ver
  // https://react.dev/learn/you-might-not-need-an-effect).
  const filterKey = `${debouncedSearch}|${JSON.stringify(debouncedColumnFilters)}|${JSON.stringify(sort)}|${pageSize}|${verEliminados}`;
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
    if (verEliminados) params.set("incluirEliminados", "true");
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    async function load() {
      setLoading(true);
      try {
        const json = await apiFetch<ApiResponse>(`/api/productos?${params.toString()}`);
        if (active) {
          setData(json);
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
  }, [debouncedSearch, debouncedColumnFilters, sort, verEliminados, page, pageSize, reloadTick]);

  const hayFiltrosActivos =
    search || Object.values(columnFilters).some((v) => v);

  function limpiarFiltros() {
    setSearch("");
    setColumnFilters(EMPTY_COLUMN_FILTERS);
  }

  // Mismos filtros/orden que la tabla, sin page/pageSize: el export baja el
  // resultado completo (ver GET /api/productos/export).
  function buildExportParams() {
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
    return params;
  }

  async function restaurarSeleccion() {
    setRestaurando(true);
    try {
      await apiFetch(`/api/productos/restaurar`, apiJsonInit({ ids: [...selectedIds] }));
      setSelectedIds(new Set());
      setReloadTick((t) => t + 1);
    } finally {
      setRestaurando(false);
    }
  }

  const rangoResultados = useMemo(() => {
    if (!data || data.total === 0) return "0 resultados";
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    return `${start}–${end} de ${data.total.toLocaleString("es-AR")}`;
  }, [data]);

  const visibleIds = data?.items.map((p) => p.id) ?? [];
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

  const selectedProducto =
    selectedIds.size === 1 ? (data?.items.find((p) => selectedIds.has(p.id)) ?? null) : null;

  function handleSingleUpdated(actualizado: Producto) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((p) => (p.id === actualizado.id ? actualizado : p)) } : prev
    );
    setSelectedIds(new Set());
  }
  // A diferencia de handleSingleUpdated, no toca selectedIds: se usa para la
  // subida/borrado de imagen dentro del diálogo de edición, una acción
  // independiente del submit del form que no debería cerrar el diálogo (si
  // limpiara la selección, selectedProducto pasaría a null y desmontaría el
  // diálogo a mitad de la edición).
  function handleImagenActualizada(actualizado: Producto) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((p) => (p.id === actualizado.id ? actualizado : p)) } : prev
    );
  }
  function handleBulkUpdated() {
    setSelectedIds(new Set());
    setReloadTick((t) => t + 1);
  }
  function handleCreated() {
    setPage(1);
    setReloadTick((t) => t + 1);
  }
  function handleDeleted(ids: number[]) {
    const eliminados = new Set(ids);
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.filter((p) => !eliminados.has(p.id)),
            total: Math.max(0, prev.total - eliminados.size),
          }
        : prev
    );
    setSelectedIds(new Set());
  }

  // Cada entrada envuelve exactamente el mismo JSX que antes estaba
  // hardcodeado en el header/las filas — ver mismo patrón en OfertasView.tsx.
  const columnDefsByKey: Record<string, { header: () => ReactNode; cell: (producto: Producto) => ReactNode }> = {
    proveedor: {
      header: () => (
        <ColumnFilterHeader
          label="Proveedor"
          value={columnFilters.proveedor}
          onChange={(v) => setColumnFilter("proveedor", v)}
          sortDirection={sort?.campo === "proveedor" ? sort.order : null}
          onSortToggle={() => toggleSort("proveedor")}
        />
      ),
      cell: (producto) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <span className="flex items-center gap-1.5">
            <HighlightText text={producto.proveedor?.nombre ?? "—"} query={debouncedSearch} />
            {producto.eliminado && <Badge variant="destructive">Eliminado</Badge>}
          </span>
        </TableCell>
      ),
    },
    marca: {
      header: () => (
        <ColumnFilterHeader
          label="Marca"
          value={columnFilters.marca}
          onChange={(v) => setColumnFilter("marca", v)}
          sortDirection={sort?.campo === "marca" ? sort.order : null}
          onSortToggle={() => toggleSort("marca")}
        />
      ),
      cell: (producto) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={producto.marca ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
    sku: {
      header: () => (
        <ColumnFilterHeader
          label="SKU interno"
          value={columnFilters.sku}
          onChange={(v) => setColumnFilter("sku", v)}
          sortDirection={sort?.campo === "sku" ? sort.order : null}
          onSortToggle={() => toggleSort("sku")}
        />
      ),
      cell: (producto) => (
        <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          <HighlightText
            text={producto.skuInterno ?? producto.skuProveedor ?? "—"}
            query={debouncedSearch}
          />
        </TableCell>
      ),
    },
    descripcion: {
      header: () => (
        <ColumnFilterHeader
          label="Descripción"
          value={columnFilters.descripcion}
          onChange={(v) => setColumnFilter("descripcion", v)}
          sortDirection={sort?.campo === "descripcion" ? sort.order : null}
          onSortToggle={() => toggleSort("descripcion")}
        />
      ),
      cell: (producto) => (
        <TableCell className="whitespace-normal text-zinc-900 dark:text-zinc-100">
          <HighlightText text={producto.descripcion ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
    seccion: {
      header: () => (
        <ColumnFilterHeader
          label="Sección"
          value={columnFilters.seccion}
          onChange={(v) => setColumnFilter("seccion", v)}
          searchOptions={secciones}
          sortDirection={sort?.campo === "seccion" ? sort.order : null}
          onSortToggle={() => toggleSort("seccion")}
        />
      ),
      cell: (producto) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={producto.seccion ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
    precioNeto: {
      header: () => (
        <ColumnFilterHeader
          label="Precio neto"
          value=""
          onChange={() => {}}
          rangeValue={{ min: columnFilters.precioNetoMin, max: columnFilters.precioNetoMax }}
          onRangeChange={(min, max) =>
            setColumnFilters((prev) => ({ ...prev, precioNetoMin: min, precioNetoMax: max }))
          }
          align="right"
          sortDirection={sort?.campo === "precioNeto" ? sort.order : null}
          onSortToggle={() => toggleSort("precioNeto")}
        />
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
          <HighlightText text={formatPrecio(producto.precioNeto)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    precioConIva: {
      header: () => (
        <ColumnFilterHeader
          label="Precio c/IVA"
          value=""
          onChange={() => {}}
          rangeValue={{
            min: columnFilters.precioConIvaMin,
            max: columnFilters.precioConIvaMax,
          }}
          onRangeChange={(min, max) =>
            setColumnFilters((prev) => ({
              ...prev,
              precioConIvaMin: min,
              precioConIvaMax: max,
            }))
          }
          align="right"
          sortDirection={sort?.campo === "precioConIva" ? sort.order : null}
          onSortToggle={() => toggleSort("precioConIva")}
        />
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
          <HighlightText text={formatPrecio(producto.precioConIva)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    alicuotaIva: {
      header: () => (
        <ColumnFilterHeader
          label="IVA %"
          value={columnFilters.alicuotaIva}
          onChange={(v) => setColumnFilter("alicuotaIva", v)}
          align="right"
          sortDirection={sort?.campo === "alicuotaIva" ? sort.order : null}
          onSortToggle={() => toggleSort("alicuotaIva")}
        />
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
          <HighlightText
            text={producto.alicuotaIva !== null ? String(producto.alicuotaIva) : "—"}
            query={debouncedSearch}
          />
        </TableCell>
      ),
    },
    fechaVigencia: {
      header: () => (
        <ColumnFilterHeader
          label="Vigencia"
          value={columnFilters.fechaVigencia}
          onChange={(v) => setColumnFilter("fechaVigencia", v)}
          sortDirection={sort?.campo === "fechaVigencia" ? sort.order : null}
          onSortToggle={() => toggleSort("fechaVigencia")}
        />
      ),
      cell: (producto) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={producto.fechaVigencia ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
  };

  const visibleColumnDefs = columnOrder
    .filter((key) => !hiddenColumns.has(key))
    .map((key) => ({ key, def: columnDefsByKey[key] }));

  const colSpan = (puedeEditar ? 1 : 0) + 1 + visibleColumnDefs.length + 1;

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
          <ColumnVisibilityMenu
            columns={CATALOGO_COLUMN_OPTIONS}
            order={columnOrder}
            hidden={hiddenColumns}
            onReorder={setColumnOrder}
            onToggle={toggleColumn}
            onReset={resetColumnPrefs}
          />
          <ExportarButton
            exportPath="/api/productos/export"
            getParams={buildExportParams}
            nombreArchivo="catalogo"
          />
          {puedeEditar && (
            <Button onClick={() => setNuevoOpen(true)}>
              <Plus className="size-3.5" />
              Nuevo producto
            </Button>
          )}
        </div>
        {puedeEditar && (
          <div className="flex items-center gap-5 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <Switch checked={verEliminados} onCheckedChange={setVerEliminados} />
              <span className="text-zinc-700 dark:text-zinc-300">Ver eliminados (papelera)</span>
            </label>
          </div>
        )}
      </section>

      <TablePaginationBar
        loading={loading}
        data={data}
        rangoResultados={rangoResultados}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        className="mb-2"
      />

      {puedeEditar && selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {selectedIds.size} seleccionada{selectedIds.size > 1 ? "s" : ""}
          </span>
          {verEliminados ? (
            // En la papelera lo único que se puede hacer es restaurar.
            <Button variant="outline" size="sm" onClick={restaurarSeleccion} disabled={restaurando}>
              {restaurando ? "Restaurando…" : "Restaurar"}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                Editar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Eliminar
              </Button>
            </>
          )}
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
              <TableHead aria-label="Imagen" />
              {visibleColumnDefs.map(({ key, def }) => (
                <Fragment key={key}>{def.header()}</Fragment>
              ))}
              <TableHead aria-label="Historial" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && data && data.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="py-8 text-center whitespace-normal text-zinc-500 dark:text-zinc-400"
                >
                  No se encontraron productos con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((producto) => {
              const isExpanded = expandedRow === producto.id;
              const hasRawData =
                producto.rawData && Object.keys(producto.rawData).length > 0;
              return (
                <Fragment key={producto.id}>
                  <TableRow
                    onClick={() =>
                      hasRawData && setExpandedRow(isExpanded ? null : producto.id)
                    }
                    className={
                      (hasRawData ? "cursor-pointer " : "") +
                      (producto.eliminado ? "opacity-60" : "")
                    }
                  >
                    {puedeEditar && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(producto.id)}
                          onCheckedChange={() => toggleRow(producto.id)}
                          aria-label="Seleccionar fila"
                        />
                      </TableCell>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {producto.imagenUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imagenSrc(producto.imagenUrl)}
                          alt=""
                          className="size-8 rounded object-cover"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                          <ImageIcon className="size-3.5" />
                        </div>
                      )}
                    </TableCell>
                    {visibleColumnDefs.map(({ key, def }) => (
                      <Fragment key={key}>{def.cell(producto)}</Fragment>
                    ))}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setHistorialProducto(producto)}
                        aria-label="Ver historial de precios"
                        title="Ver historial de precios"
                      >
                        <History className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && hasRawData && (
                    <TableRow className="bg-zinc-50 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-950">
                      <TableCell colSpan={colSpan} className="whitespace-normal py-3">
                        <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          Columnas originales no mapeadas al schema canónico
                          (raw_data):
                        </p>
                        <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                          {JSON.stringify(producto.rawData, null, 2)}
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

      <TablePaginationBar
        loading={loading}
        data={data}
        rangoResultados={rangoResultados}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        className="mt-2"
      />

      {editOpen && selectedProducto && (
        <EditarProductoDialog
          producto={selectedProducto}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleSingleUpdated}
          onImagenUpdated={handleImagenActualizada}
        />
      )}
      <NuevoProductoDialog open={nuevoOpen} onOpenChange={setNuevoOpen} onCreated={handleCreated} />
      {editOpen && !selectedProducto && selectedIds.size > 1 && (
        <BulkEditarProductoDialog
          ids={[...selectedIds]}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleBulkUpdated}
        />
      )}
      <EliminarProductosDialog
        ids={[...selectedIds]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={handleDeleted}
      />
      {historialProducto && (
        <HistorialProductoDialog
          producto={historialProducto}
          open={historialProducto !== null}
          onOpenChange={(next) => {
            if (!next) setHistorialProducto(null);
          }}
        />
      )}
    </>
  );
}
