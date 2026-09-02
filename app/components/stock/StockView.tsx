"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, History } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import { estaBajoMinimo, STOCK_EMPTY_COLUMN_FILTERS, type ArticuloStock, type StockColumnKey } from "@/app/lib/stock";
import { useColumnPrefs } from "@/app/lib/useColumnPrefs";
import { useTablaRecurso } from "@/app/lib/useTablaRecurso";
import ColumnFilterHeader from "@/app/components/ColumnFilterHeader";
import ColumnVisibilityMenu, { type ColumnOption } from "@/app/components/ColumnVisibilityMenu";
import ExportarButton from "@/app/components/ExportarButton";
import HighlightText from "@/app/components/HighlightText";
import SortableResizableHead from "@/app/components/SortableResizableHead";
import TablePaginationBar from "@/app/components/TablePaginationBar";
import EditarArticuloDialog from "@/app/components/stock/EditarArticuloDialog";
import EliminarArticulosDialog from "@/app/components/stock/EliminarArticulosDialog";
import HistorialArticuloDialog from "@/app/components/stock/HistorialArticuloDialog";
import MovimientoDialog from "@/app/components/stock/MovimientoDialog";
import NuevoArticuloDialog from "@/app/components/stock/NuevoArticuloDialog";
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
import { cn } from "@/lib/utils";

type ApiResponse = {
  items: ArticuloStock[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZES = [50, 100, 200] as const;

// Igual que en CatalogoView/OfertasView: checkbox, cantidad/mínimo y acciones
// son estructurales (fijas, no reordenables) y no entran acá — ver el orden
// de columnas descripto en el render de más abajo.
const STOCK_COLUMN_OPTIONS: ColumnOption[] = [
  { key: "marca", label: "Marca" },
  { key: "codigo", label: "Código" },
  { key: "descripcion", label: "Descripción" },
  { key: "categoria", label: "Categoría" },
  { key: "ubicacion", label: "Ubicación" },
];
const STOCK_DEFAULT_COLUMN_ORDER = STOCK_COLUMN_OPTIONS.map((c) => c.key);

// Ver mismo criterio en CatalogoView.tsx.
const STOCK_DEFAULT_WIDTHS: Record<string, number> = {
  marca: 140,
  codigo: 130,
  descripcion: 300,
  categoria: 150,
  ubicacion: 150,
};

export default function StockView() {
  const tabla = useTablaRecurso({
    filtrosIniciales: STOCK_EMPTY_COLUMN_FILTERS,
    pageSizeInicial: PAGE_SIZES[0],
  });
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Valores para el combobox del filtro de Categoría; si el fetch falla el
  // filtro simplemente queda vacío (se puede seguir usando el resto). Mismo
  // patrón que `secciones` en CatalogoView.tsx.
  const [categorias, setCategorias] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    apiFetch<(string | null)[]>("/api/stock/categorias")
      .then((data) => {
        if (active) setCategorias(data.filter((c): c is string => c !== null && c !== ""));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  // Controla HistorialArticuloDialog: no-nulo == abierto, ver ese componente.
  const [historial, setHistorial] = useState<ArticuloStock | null>(null);

  const {
    order: columnOrder,
    hidden: hiddenColumns,
    widths: columnWidths,
    setOrder: setColumnOrder,
    toggleColumn,
    setWidth: setColumnWidth,
    reset: resetColumnPrefs,
  } = useColumnPrefs("lv:columnas:stock", STOCK_DEFAULT_COLUMN_ORDER);

  // Mismo sensor que ColumnVisibilityMenu (distancia mínima para no comerse
  // un click en el grip por accidente) — acá reordena arrastrando el <th>
  // en vivo en vez de una fila en el menú aislado.
  const columnDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columnOrder.indexOf(String(active.id));
    const newIndex = columnOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
  }

  // Para el resaltado se usa el término ya confirmado por el debounce, no el
  // crudo (ver comentario en useTablaRecurso).
  const debouncedSearch = tabla.debouncedSearch;

  // soloBajoMinimo es un filtro propio de Stock y no vive en useTablaRecurso
  // (ver comentario ahí), pero tiene que resetear la página igual que los
  // demás filtros — mismo patrón que incluirCerradas en OfertasView.tsx.
  const [prevSoloBajoMinimo, setPrevSoloBajoMinimo] = useState(soloBajoMinimo);
  if (soloBajoMinimo !== prevSoloBajoMinimo) {
    setPrevSoloBajoMinimo(soloBajoMinimo);
    tabla.setPage(1);
  }

  useEffect(() => {
    let active = true;
    const params = tabla.buildParams(true);
    if (soloBajoMinimo) params.set("soloBajoMinimo", "true");

    async function load() {
      setLoading(true);
      try {
        const json = await apiFetch<ApiResponse>(`/api/stock?${params.toString()}`);
        if (active) {
          setData(json);
          tabla.clearSelection();
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla.fetchKey, soloBajoMinimo]);

  // Mismos filtros/orden que la tabla, sin page/pageSize: el export baja el
  // resultado completo (ver GET /api/stock/export).
  const buildExportParams = () => {
    const p = tabla.buildParams(false);
    if (soloBajoMinimo) p.set("soloBajoMinimo", "true");
    return p;
  };

  async function restaurarSeleccion() {
    setRestaurando(true);
    try {
      await apiFetch("/api/stock/restaurar", apiJsonInit({ ids: [...tabla.selectedIds] }));
      tabla.clearSelection();
      tabla.recargar();
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

  const visibleIds = data?.items.map((a) => a.id) ?? [];
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => tabla.selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => tabla.selectedIds.has(id));

  // Papelera / filtros activos (incluye soloBajoMinimo) / vacío total — en
  // ese orden de prioridad.
  const emptyMessage = tabla.verEliminados
    ? "No hay artículos eliminados"
    : tabla.hayFiltrosActivos || soloBajoMinimo
      ? "Ningún artículo coincide con los filtros"
      : "Todavía no hay artículos cargados";

  // Cabecera de cantidad/mínimo: ordenable como las demás (ver columnas
  // ordenables en GET /api/stock), pero fija — no filtrable, no reordenable,
  // no redimensionable — así que no pasa por ColumnFilterHeader ni por
  // useColumnPrefs, solo replica el botón de orden con el mismo look.
  function sortOnlyHead(label: string, campo: string, widthClass: string) {
    const sortDirection = tabla.sort?.campo === campo ? tabla.sort.order : null;
    return (
      <TableHead className={cn(widthClass, "text-right")}>
        <button
          type="button"
          onClick={() => tabla.toggleSort(campo)}
          className="flex w-full items-center justify-end gap-0.5 hover:text-foreground"
          aria-label={`Ordenar por ${label.toLowerCase()}`}
        >
          <span className="truncate">{label}</span>
          {sortDirection === "asc" ? (
            <ArrowUp className="size-3 shrink-0 text-foreground" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="size-3 shrink-0 text-foreground" />
          ) : (
            <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground/50" />
          )}
        </button>
      </TableHead>
    );
  }

  // Cada entrada envuelve exactamente el mismo JSX que antes estaba
  // hardcodeado en el header/las filas — ver mismo patrón en CatalogoView.tsx.
  const columnDefsByKey: Record<
    StockColumnKey,
    { header: () => ReactNode; cell: (articulo: ArticuloStock) => ReactNode }
  > = {
    marca: {
      header: () => (
        <SortableResizableHead
          columnKey="marca"
          width={columnWidths.marca ?? STOCK_DEFAULT_WIDTHS.marca}
          defaultWidth={STOCK_DEFAULT_WIDTHS.marca}
          onResize={(px) => setColumnWidth("marca", px)}
        >
          <ColumnFilterHeader
            label="Marca"
            value={tabla.columnFilters.marca}
            onChange={(v) => tabla.setColumnFilter("marca", v)}
            sortDirection={tabla.sort?.campo === "marca" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("marca")}
          />
        </SortableResizableHead>
      ),
      cell: (articulo) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={articulo.marca} query={debouncedSearch} />
        </TableCell>
      ),
    },
    codigo: {
      header: () => (
        <SortableResizableHead
          columnKey="codigo"
          width={columnWidths.codigo ?? STOCK_DEFAULT_WIDTHS.codigo}
          defaultWidth={STOCK_DEFAULT_WIDTHS.codigo}
          onResize={(px) => setColumnWidth("codigo", px)}
        >
          <ColumnFilterHeader
            label="Código"
            value={tabla.columnFilters.codigo}
            onChange={(v) => tabla.setColumnFilter("codigo", v)}
            sortDirection={tabla.sort?.campo === "codigo" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("codigo")}
          />
        </SortableResizableHead>
      ),
      cell: (articulo) => (
        <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          <HighlightText text={articulo.codigo} query={debouncedSearch} />
        </TableCell>
      ),
    },
    descripcion: {
      header: () => (
        <SortableResizableHead
          columnKey="descripcion"
          width={columnWidths.descripcion ?? STOCK_DEFAULT_WIDTHS.descripcion}
          defaultWidth={STOCK_DEFAULT_WIDTHS.descripcion}
          onResize={(px) => setColumnWidth("descripcion", px)}
        >
          <ColumnFilterHeader
            label="Descripción"
            value={tabla.columnFilters.descripcion}
            onChange={(v) => tabla.setColumnFilter("descripcion", v)}
            sortDirection={tabla.sort?.campo === "descripcion" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("descripcion")}
          />
        </SortableResizableHead>
      ),
      cell: (articulo) => (
        <TableCell className="whitespace-normal text-zinc-900 dark:text-zinc-100">
          <HighlightText text={articulo.descripcion} query={debouncedSearch} />
        </TableCell>
      ),
    },
    categoria: {
      header: () => (
        <SortableResizableHead
          columnKey="categoria"
          width={columnWidths.categoria ?? STOCK_DEFAULT_WIDTHS.categoria}
          defaultWidth={STOCK_DEFAULT_WIDTHS.categoria}
          onResize={(px) => setColumnWidth("categoria", px)}
        >
          <ColumnFilterHeader
            label="Categoría"
            value={tabla.columnFilters.categoria}
            onChange={(v) => tabla.setColumnFilter("categoria", v)}
            searchOptions={categorias}
            sortDirection={tabla.sort?.campo === "categoria" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("categoria")}
          />
        </SortableResizableHead>
      ),
      cell: (articulo) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={articulo.categoria ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
    ubicacion: {
      header: () => (
        <SortableResizableHead
          columnKey="ubicacion"
          width={columnWidths.ubicacion ?? STOCK_DEFAULT_WIDTHS.ubicacion}
          defaultWidth={STOCK_DEFAULT_WIDTHS.ubicacion}
          onResize={(px) => setColumnWidth("ubicacion", px)}
        >
          <ColumnFilterHeader
            label="Ubicación"
            value={tabla.columnFilters.ubicacion}
            onChange={(v) => tabla.setColumnFilter("ubicacion", v)}
            sortDirection={tabla.sort?.campo === "ubicacion" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("ubicacion")}
          />
        </SortableResizableHead>
      ),
      cell: (articulo) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={articulo.ubicacion ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
  };

  const visibleColumnDefs = columnOrder
    .filter((key): key is StockColumnKey => !hiddenColumns.has(key))
    .map((key) => ({ key, def: columnDefsByKey[key] }));

  // checkbox + columnas dinámicas visibles + cantidad + mínimo + acciones.
  const colSpan = 1 + visibleColumnDefs.length + 2 + 1;

  return (
    <>
      <section className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-end gap-3">
          <div className="flex flex-1 flex-col gap-1 text-sm">
            <Label htmlFor="stock-search" className="text-zinc-600 dark:text-zinc-400">
              Buscar en todos los campos
            </Label>
            <Input
              id="stock-search"
              type="text"
              value={tabla.search}
              onChange={(e) => tabla.setSearch(e.target.value)}
              placeholder="Ej: HU718, Mann, filtro de aceite, Estante A3..."
            />
          </div>

          {tabla.hayFiltrosActivos && (
            <Button variant="outline" onClick={tabla.limpiarFiltros}>
              Limpiar filtros
            </Button>
          )}
          <ColumnVisibilityMenu
            columns={STOCK_COLUMN_OPTIONS}
            order={columnOrder}
            hidden={hiddenColumns}
            onReorder={setColumnOrder}
            onToggle={toggleColumn}
            onReset={resetColumnPrefs}
          />
          <ExportarButton
            exportPath="/api/stock/export"
            getParams={buildExportParams}
            nombreArchivo="stock"
          />
          <NuevoArticuloDialog onCreado={tabla.recargar} />
        </div>
        <div className="flex items-center gap-5 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={soloBajoMinimo} onCheckedChange={setSoloBajoMinimo} />
            <span className="text-zinc-700 dark:text-zinc-300">Solo bajo mínimo</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={tabla.verEliminados} onCheckedChange={tabla.setVerEliminados} />
            <span className="text-zinc-700 dark:text-zinc-300">Ver eliminados (papelera)</span>
          </label>
        </div>
      </section>

      <TablePaginationBar
        loading={loading}
        data={data}
        rangoResultados={rangoResultados}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={tabla.setPage}
        onPageSizeChange={tabla.setPageSize}
        className="mb-2"
      />

      {tabla.selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {tabla.selectedIds.size} seleccionado{tabla.selectedIds.size > 1 ? "s" : ""}
          </span>
          {tabla.verEliminados ? (
            // En la papelera lo único que se puede hacer es restaurar.
            <Button variant="outline" size="sm" onClick={restaurarSeleccion} disabled={restaurando}>
              {restaurando ? "Restaurando…" : "Restaurar"}
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              Eliminar
            </Button>
          )}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) => tabla.toggleAll(visibleIds, Boolean(checked))}
                  aria-label="Seleccionar todo"
                />
              </TableHead>
              <DndContext
                sensors={columnDragSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleColumnDragEnd}
              >
                <SortableContext
                  items={visibleColumnDefs.map(({ key }) => key)}
                  strategy={horizontalListSortingStrategy}
                >
                  {visibleColumnDefs.map(({ key, def }) => (
                    <Fragment key={key}>{def.header()}</Fragment>
                  ))}
                </SortableContext>
              </DndContext>
              {sortOnlyHead("Cantidad", "cantidad", "w-40")}
              {sortOnlyHead("Mínimo", "minimo", "w-24")}
              <TableHead aria-label="Acciones" className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && data && data.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="py-8 text-center whitespace-normal text-zinc-500 dark:text-zinc-400"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              data?.items.map((articulo) => (
                <TableRow key={articulo.id} className={articulo.eliminado ? "opacity-60" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={tabla.selectedIds.has(articulo.id)}
                      onCheckedChange={() => tabla.toggleRow(articulo.id)}
                      aria-label="Seleccionar fila"
                    />
                  </TableCell>
                  {visibleColumnDefs.map(({ key, def }) => (
                    <Fragment key={key}>{def.cell(articulo)}</Fragment>
                  ))}
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span
                        className={cn(
                          articulo.cantidad < 0
                            ? "font-medium text-destructive"
                            : "text-zinc-900 dark:text-zinc-100"
                        )}
                      >
                        {articulo.cantidad}
                      </span>
                      {estaBajoMinimo(articulo) && <Badge variant="outline">Bajo mínimo</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                    {articulo.minimo ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MovimientoDialog articulo={articulo} onRegistrado={tabla.recargar} />
                      <EditarArticuloDialog articulo={articulo} onEditado={tabla.recargar} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setHistorial(articulo)}
                        aria-label="Ver historial de movimientos"
                        title="Ver historial de movimientos"
                      >
                        <History />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <TablePaginationBar
        loading={loading}
        data={data}
        rangoResultados={rangoResultados}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={tabla.setPage}
        onPageSizeChange={tabla.setPageSize}
        className="mt-2"
      />

      <EliminarArticulosDialog
        ids={[...tabla.selectedIds]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onEliminado={() => {
          tabla.clearSelection();
          tabla.recargar();
        }}
      />
      <HistorialArticuloDialog
        articulo={historial}
        onOpenChange={(next) => {
          if (!next) setHistorial(null);
        }}
      />
    </>
  );
}
