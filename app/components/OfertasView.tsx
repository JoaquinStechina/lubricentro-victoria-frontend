"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { History, ImageIcon, Plus } from "lucide-react";
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
import { apiFetch, apiJsonInit, imagenSrc } from "@/app/lib/api";
import type { Oferta, OfertaColumnKey } from "@/app/lib/ofertas";
import { useColumnPrefs } from "@/app/lib/useColumnPrefs";
import { useTablaRecurso } from "@/app/lib/useTablaRecurso";
import ColumnFilterHeader from "@/app/components/ColumnFilterHeader";
import ColumnVisibilityMenu, { type ColumnOption } from "@/app/components/ColumnVisibilityMenu";
import ExportarButton from "@/app/components/ExportarButton";
import HighlightText from "@/app/components/HighlightText";
import SortableResizableHead from "@/app/components/SortableResizableHead";
import TablePaginationBar from "@/app/components/TablePaginationBar";
import EditarOfertaDialog from "@/app/components/ofertas/EditarOfertaDialog";
import NuevaOfertaDialog from "@/app/components/ofertas/NuevaOfertaDialog";
import BulkEditarOfertaDialog from "@/app/components/ofertas/BulkEditarOfertaDialog";
import EliminarOfertasDialog from "@/app/components/ofertas/EliminarOfertasDialog";
import HistorialOfertaDialog from "@/app/components/ofertas/HistorialOfertaDialog";
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
  items: Oferta[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZES = [50, 100, 200] as const;

// Definen tanto el orden por defecto de las columnas de datos como las
// etiquetas que se muestran en el menú "Columnas" — el checkbox de
// selección, la miniatura y el botón de historial quedan fijos (no son
// datos) y no entran acá.
const OFERTAS_COLUMN_OPTIONS: ColumnOption[] = [
  { key: "marca", label: "Marca" },
  { key: "numeroOferta", label: "N° oferta" },
  { key: "sku", label: "SKU proveedor" },
  { key: "descripcion", label: "Descripción" },
  { key: "desdeCantidad", label: "Desde cant." },
  { key: "descuentoPct", label: "Descuento" },
  { key: "precioUnitario", label: "Precio unitario" },
  { key: "cantidadDisponible", label: "Cantidad disp." },
  { key: "fechaOferta", label: "Vigencia" },
  { key: "fechaHasta", label: "Válida hasta" },
  { key: "estado", label: "Estado" },
];
const OFERTAS_DEFAULT_COLUMN_ORDER = OFERTAS_COLUMN_OPTIONS.map((c) => c.key);

// Ver mismo criterio en CatalogoView.tsx.
const OFERTAS_DEFAULT_WIDTHS: Record<string, number> = {
  marca: 130,
  numeroOferta: 100,
  sku: 130,
  descripcion: 260,
  desdeCantidad: 100,
  descuentoPct: 100,
  precioUnitario: 130,
  cantidadDisponible: 110,
  fechaOferta: 110,
  fechaHasta: 140,
  estado: 110,
};

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
  cantidadDisponibleMin: "",
  cantidadDisponibleMax: "",
};

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

// Descuento % no es moneda (no pasa por currencyFormatter): igual se limita
// a 2 decimales acá, la fuente de verdad es el redondeo que ya hace el
// backend al guardar, esto solo cubre datos viejos que hayan quedado con más.
function formatPorcentaje(valor: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(valor);
}

// Fecha local en YYYY-MM-DD (en-CA da ese formato) — no usar toISOString(),
// que es UTC y en Argentina marcaría como vencida una oferta que todavía
// vence "hoy". Mismo criterio que hoyLocalISO() en el backend.
function hoyLocalISO(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

// Mismo cálculo que el backend (buildOfertasWhere / export): "Cerrada" es
// el cierre manual, "Vencida" el vencimiento por fecha.
function estadoOferta(oferta: Oferta, hoy: string): {
  label: string;
  variant: "secondary" | "outline" | "destructive";
} {
  if (!oferta.activa) return { label: "Cerrada", variant: "outline" };
  if (oferta.fechaHasta && oferta.fechaHasta < hoy) {
    return { label: "Vencida", variant: "destructive" };
  }
  return { label: "Activa", variant: "secondary" };
}

// Paginación server-side, mismo patrón que CatalogoView.tsx (antes traía
// todo el resultado filtrado y paginaba en memoria).
export default function OfertasView() {
  const tabla = useTablaRecurso({
    filtrosIniciales: EMPTY_COLUMN_FILTERS,
    pageSizeInicial: PAGE_SIZES[0],
  });
  const [incluirCerradas, setIncluirCerradas] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [historialOferta, setHistorialOferta] = useState<Oferta | null>(null);

  const {
    order: columnOrder,
    hidden: hiddenColumns,
    widths: columnWidths,
    setOrder: setColumnOrder,
    toggleColumn,
    setWidth: setColumnWidth,
    reset: resetColumnPrefs,
  } = useColumnPrefs("lv:columnas:ofertas", OFERTAS_DEFAULT_COLUMN_ORDER);

  // Ver mismo criterio en CatalogoView.tsx.
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

  // incluirCerradas es un filtro propio de Ofertas y no vive en
  // useTablaRecurso (ver comentario ahí), pero tiene que resetear la página
  // igual que los demás filtros.
  const [prevIncluirCerradas, setPrevIncluirCerradas] = useState(incluirCerradas);
  if (incluirCerradas !== prevIncluirCerradas) {
    setPrevIncluirCerradas(incluirCerradas);
    tabla.setPage(1);
  }

  useEffect(() => {
    let active = true;
    const params = tabla.buildParams(true);
    if (incluirCerradas) params.set("incluirCerradas", "true");

    async function load() {
      setLoading(true);
      try {
        const json = await apiFetch<ApiResponse>(`/api/ofertas?${params.toString()}`);
        if (active) {
          setData(json);
          setExpandedRow(null);
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
  }, [tabla.fetchKey, incluirCerradas]);

  // Mismos filtros/orden que la tabla, sin page/pageSize: el export baja el
  // resultado completo (ver GET /api/ofertas/export).
  const buildExportParams = () => {
    const p = tabla.buildParams(false);
    if (incluirCerradas) p.set("incluirCerradas", "true");
    return p;
  };

  const pageItems = data?.items ?? [];

  const rangoResultados = useMemo(() => {
    if (!data || data.total === 0) return "0 resultados";
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    return `${start}–${end} de ${data.total.toLocaleString("es-AR")}`;
  }, [data]);

  const visibleIds = pageItems.map((o) => o.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => tabla.selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => tabla.selectedIds.has(id));

  const selectedOferta =
    tabla.selectedIds.size === 1 ? (data?.items.find((o) => tabla.selectedIds.has(o.id)) ?? null) : null;

  function handleSingleUpdated(actualizada: Oferta) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((o) => (o.id === actualizada.id ? actualizada : o)) } : prev
    );
    tabla.clearSelection();
  }
  // A diferencia de handleSingleUpdated, no toca selectedIds — ver el mismo
  // criterio documentado en CatalogoView.tsx.
  function handleImagenActualizada(actualizada: Oferta) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((o) => (o.id === actualizada.id ? actualizada : o)) } : prev
    );
  }
  function handleBulkUpdated() {
    tabla.clearSelection();
    tabla.recargar();
  }
  function handleDeleted(ids: number[]) {
    const eliminadas = new Set(ids);
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.filter((o) => !eliminadas.has(o.id)),
            total: Math.max(0, prev.total - eliminadas.size),
          }
        : prev
    );
    tabla.clearSelection();
  }
  function handleCreated() {
    tabla.setPage(1);
    tabla.recargar();
  }

  const seleccionadas = data?.items.filter((o) => tabla.selectedIds.has(o.id)) ?? [];
  const paraCerrar = seleccionadas.filter((o) => o.activa);
  const paraReactivar = seleccionadas.filter((o) => !o.activa);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  // Cerrar/reactivar opera por (proveedorId, numeroOferta, skuProveedor):
  // afecta TODOS los tramos de cantidad de ese SKU en esa oferta, incluso
  // filas no seleccionadas — "se acabó el stock" es un hecho del producto,
  // no de un tramo (ver backend POST /api/ofertas/cerrar).
  async function cambiarEstadoSeleccion(accion: "cerrar" | "reactivar") {
    const filas = accion === "cerrar" ? paraCerrar : paraReactivar;
    const porSku = new Map<string, { proveedorId: number; numeroOferta: number; skuProveedor: string }>();
    for (const o of filas) {
      porSku.set(`${o.proveedorId}|${o.numeroOferta}|${o.skuProveedor}`, {
        proveedorId: o.proveedorId,
        numeroOferta: o.numeroOferta,
        skuProveedor: o.skuProveedor,
      });
    }
    setCambiandoEstado(true);
    try {
      for (const body of porSku.values()) {
        await apiFetch(`/api/ofertas/${accion}`, apiJsonInit(body));
      }
      tabla.clearSelection();
      tabla.recargar();
    } finally {
      setCambiandoEstado(false);
    }
  }

  async function restaurarSeleccion() {
    setCambiandoEstado(true);
    try {
      await apiFetch(`/api/ofertas/restaurar`, apiJsonInit({ ids: [...tabla.selectedIds] }));
      tabla.clearSelection();
      tabla.recargar();
    } finally {
      setCambiandoEstado(false);
    }
  }

  const hoy = hoyLocalISO();

  // Cada entrada envuelve exactamente el mismo JSX que antes estaba
  // hardcodeado en el header/las filas — nada de contenido cambia acá, solo
  // pasa a poder mostrarse/ocultarse y reordenarse.
  const columnDefsByKey: Record<string, { header: () => ReactNode; cell: (oferta: Oferta) => ReactNode }> = {
    marca: {
      header: () => (
        <SortableResizableHead
          columnKey="marca"
          width={columnWidths.marca ?? OFERTAS_DEFAULT_WIDTHS.marca}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.marca}
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
      cell: (oferta) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={oferta.marca} query={debouncedSearch} />
        </TableCell>
      ),
    },
    numeroOferta: {
      header: () => (
        <SortableResizableHead
          columnKey="numeroOferta"
          width={columnWidths.numeroOferta ?? OFERTAS_DEFAULT_WIDTHS.numeroOferta}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.numeroOferta}
          onResize={(px) => setColumnWidth("numeroOferta", px)}
        >
          <ColumnFilterHeader
            label="N° oferta"
            value={tabla.columnFilters.numeroOferta}
            onChange={(v) => tabla.setColumnFilter("numeroOferta", v)}
            sortDirection={tabla.sort?.campo === "numeroOferta" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("numeroOferta")}
          />
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={String(oferta.numeroOferta)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    sku: {
      header: () => (
        <SortableResizableHead
          columnKey="sku"
          width={columnWidths.sku ?? OFERTAS_DEFAULT_WIDTHS.sku}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.sku}
          onResize={(px) => setColumnWidth("sku", px)}
        >
          <ColumnFilterHeader
            label="SKU proveedor"
            value={tabla.columnFilters.sku}
            onChange={(v) => tabla.setColumnFilter("sku", v)}
            sortDirection={tabla.sort?.campo === "sku" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("sku")}
          />
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          <HighlightText text={oferta.skuProveedor} query={debouncedSearch} />
        </TableCell>
      ),
    },
    descripcion: {
      header: () => (
        <SortableResizableHead
          columnKey="descripcion"
          width={columnWidths.descripcion ?? OFERTAS_DEFAULT_WIDTHS.descripcion}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.descripcion}
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
      cell: (oferta) => (
        <TableCell className="whitespace-normal text-zinc-900 dark:text-zinc-100">
          <HighlightText text={oferta.descripcion} query={debouncedSearch} />
        </TableCell>
      ),
    },
    desdeCantidad: {
      header: () => (
        <SortableResizableHead
          columnKey="desdeCantidad"
          width={columnWidths.desdeCantidad ?? OFERTAS_DEFAULT_WIDTHS.desdeCantidad}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.desdeCantidad}
          onResize={(px) => setColumnWidth("desdeCantidad", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Desde cant."
            value={tabla.columnFilters.desdeCantidad}
            onChange={(v) => tabla.setColumnFilter("desdeCantidad", v)}
            align="right"
            sortDirection={tabla.sort?.campo === "desdeCantidad" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("desdeCantidad")}
          />
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
          <HighlightText text={String(oferta.desdeCantidad)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    descuentoPct: {
      header: () => (
        <SortableResizableHead
          columnKey="descuentoPct"
          width={columnWidths.descuentoPct ?? OFERTAS_DEFAULT_WIDTHS.descuentoPct}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.descuentoPct}
          onResize={(px) => setColumnWidth("descuentoPct", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Descuento"
            value=""
            onChange={() => {}}
            rangeValue={{ min: tabla.columnFilters.descuentoPctMin, max: tabla.columnFilters.descuentoPctMax }}
            onRangeChange={(min, max) => {
              tabla.setColumnFilter("descuentoPctMin", min);
              tabla.setColumnFilter("descuentoPctMax", max);
            }}
            align="right"
            sortDirection={tabla.sort?.campo === "descuentoPct" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("descuentoPct")}
          />
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
          <HighlightText text={`${formatPorcentaje(oferta.descuentoPct)}%`} query={debouncedSearch} />
        </TableCell>
      ),
    },
    precioUnitario: {
      header: () => (
        <SortableResizableHead
          columnKey="precioUnitario"
          width={columnWidths.precioUnitario ?? OFERTAS_DEFAULT_WIDTHS.precioUnitario}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.precioUnitario}
          onResize={(px) => setColumnWidth("precioUnitario", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Precio unitario"
            value=""
            onChange={() => {}}
            rangeValue={{
              min: tabla.columnFilters.precioUnitarioMin,
              max: tabla.columnFilters.precioUnitarioMax,
            }}
            onRangeChange={(min, max) => {
              tabla.setColumnFilter("precioUnitarioMin", min);
              tabla.setColumnFilter("precioUnitarioMax", max);
            }}
            align="right"
            sortDirection={tabla.sort?.campo === "precioUnitario" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("precioUnitario")}
          />
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
          <HighlightText text={formatPrecio(oferta.precioUnitario)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    cantidadDisponible: {
      header: () => (
        <SortableResizableHead
          columnKey="cantidadDisponible"
          width={columnWidths.cantidadDisponible ?? OFERTAS_DEFAULT_WIDTHS.cantidadDisponible}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.cantidadDisponible}
          onResize={(px) => setColumnWidth("cantidadDisponible", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Cantidad disp."
            value=""
            onChange={() => {}}
            rangeValue={{
              min: tabla.columnFilters.cantidadDisponibleMin,
              max: tabla.columnFilters.cantidadDisponibleMax,
            }}
            onRangeChange={(min, max) => {
              tabla.setColumnFilter("cantidadDisponibleMin", min);
              tabla.setColumnFilter("cantidadDisponibleMax", max);
            }}
            align="right"
            sortDirection={tabla.sort?.campo === "cantidadDisponible" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("cantidadDisponible")}
          />
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
          {oferta.cantidadDisponible ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
        </TableCell>
      ),
    },
    fechaOferta: {
      header: () => (
        <SortableResizableHead
          columnKey="fechaOferta"
          width={columnWidths.fechaOferta ?? OFERTAS_DEFAULT_WIDTHS.fechaOferta}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.fechaOferta}
          onResize={(px) => setColumnWidth("fechaOferta", px)}
        >
          <ColumnFilterHeader
            label="Vigencia"
            value={tabla.columnFilters.fechaOferta}
            onChange={(v) => tabla.setColumnFilter("fechaOferta", v)}
            sortDirection={tabla.sort?.campo === "fechaOferta" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("fechaOferta")}
          />
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={oferta.fechaOferta} query={debouncedSearch} />
        </TableCell>
      ),
    },
    fechaHasta: {
      header: () => (
        <SortableResizableHead
          columnKey="fechaHasta"
          width={columnWidths.fechaHasta ?? OFERTAS_DEFAULT_WIDTHS.fechaHasta}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.fechaHasta}
          onResize={(px) => setColumnWidth("fechaHasta", px)}
        >
          <ColumnFilterHeader
            label="Válida hasta"
            value={tabla.columnFilters.vigencia}
            onChange={(v) => tabla.setColumnFilter("vigencia", v)}
            options={VIGENCIA_OPTIONS}
            dateValue={tabla.columnFilters.fechaHasta}
            onDateChange={(v) => tabla.setColumnFilter("fechaHasta", v)}
            sortDirection={tabla.sort?.campo === "fechaHasta" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("fechaHasta")}
          />
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          {oferta.fechaHasta ?? (
            <span className="text-zinc-500 dark:text-zinc-500">Hasta agotar stock</span>
          )}
        </TableCell>
      ),
    },
    estado: {
      header: () => (
        <SortableResizableHead
          columnKey="estado"
          width={columnWidths.estado ?? OFERTAS_DEFAULT_WIDTHS.estado}
          defaultWidth={OFERTAS_DEFAULT_WIDTHS.estado}
          onResize={(px) => setColumnWidth("estado", px)}
        >
          Estado
        </SortableResizableHead>
      ),
      cell: (oferta) => (
        <TableCell>
          <span className="flex items-center gap-1.5">
            {(() => {
              const estado = estadoOferta(oferta, hoy);
              return <Badge variant={estado.variant}>{estado.label}</Badge>;
            })()}
            {oferta.eliminado && <Badge variant="destructive">Eliminada</Badge>}
          </span>
        </TableCell>
      ),
    },
  };

  const visibleColumnDefs = columnOrder
    .filter((key) => !hiddenColumns.has(key))
    .map((key) => ({ key, def: columnDefsByKey[key] }));

  const colSpan = 1 + 1 + visibleColumnDefs.length + 1;

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
              value={tabla.search}
              onChange={(e) => tabla.setSearch(e.target.value)}
              placeholder="Ej: 65/0001, S4 36 DA, Bosch..."
            />
          </div>

          {tabla.hayFiltrosActivos && (
            <Button variant="outline" onClick={tabla.limpiarFiltros}>
              Limpiar filtros
            </Button>
          )}
          <ColumnVisibilityMenu
            columns={OFERTAS_COLUMN_OPTIONS}
            order={columnOrder}
            hidden={hiddenColumns}
            onReorder={setColumnOrder}
            onToggle={toggleColumn}
            onReset={resetColumnPrefs}
          />
          <ExportarButton
            exportPath="/api/ofertas/export"
            getParams={buildExportParams}
            nombreArchivo="ofertas"
          />
          <Button onClick={() => setNuevoOpen(true)}>
            <Plus className="size-3.5" />
            Nueva oferta
          </Button>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={incluirCerradas} onCheckedChange={setIncluirCerradas} />
            <span className="text-zinc-700 dark:text-zinc-300">Ver cerradas/vencidas</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={tabla.verEliminados} onCheckedChange={tabla.setVerEliminados} />
            <span className="text-zinc-700 dark:text-zinc-300">Ver eliminadas (papelera)</span>
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
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {tabla.selectedIds.size} seleccionada{tabla.selectedIds.size > 1 ? "s" : ""}
          </span>
          {tabla.verEliminados ? (
            // En la papelera lo único que se puede hacer es restaurar.
            <Button variant="outline" size="sm" onClick={restaurarSeleccion} disabled={cambiandoEstado}>
              {cambiandoEstado ? "Restaurando…" : "Restaurar"}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                Editar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Eliminar
              </Button>
              {paraCerrar.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cambiarEstadoSeleccion("cerrar")}
                  disabled={cambiandoEstado}
                  title="Cierra todos los tramos de cantidad de ese SKU en esa oferta, incluso los no seleccionados"
                >
                  Marcar agotada
                </Button>
              )}
              {paraReactivar.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cambiarEstadoSeleccion("reactivar")}
                  disabled={cambiandoEstado}
                >
                  Reactivar
                </Button>
              )}
              {paraCerrar.length > 0 && (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  Cerrar una oferta afecta todos los tramos de ese SKU.
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* DndContext va FUERA de la tabla a propósito: renderiza un <div> de
          accesibilidad como hermano de sus hijos, y adentro de un <tr> el
          navegador lo trata como una celda anónima que corre una posición
          todas las columnas siguientes. SortableContext no emite DOM, así que
          puede quedarse adentro de la fila. */}
      <DndContext
        sensors={columnDragSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
      >
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
              <TableHead aria-label="Imagen" className="w-14" />
              <SortableContext
                items={visibleColumnDefs.map(({ key }) => key)}
                strategy={horizontalListSortingStrategy}
              >
                {visibleColumnDefs.map(({ key, def }) => (
                  <Fragment key={key}>{def.header()}</Fragment>
                ))}
              </SortableContext>
              <TableHead aria-label="Historial" className="w-12" />
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
                    className={oferta.eliminado ? "cursor-pointer opacity-60" : "cursor-pointer"}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={tabla.selectedIds.has(oferta.id)}
                        onCheckedChange={() => tabla.toggleRow(oferta.id)}
                        aria-label="Seleccionar fila"
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {oferta.imagenUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imagenSrc(oferta.imagenUrl)}
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
                      <Fragment key={key}>{def.cell(oferta)}</Fragment>
                    ))}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setHistorialOferta(oferta)}
                        aria-label="Ver historial del tramo"
                        title="Ver historial del tramo"
                      >
                        <History className="size-3.5" />
                      </Button>
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
      </DndContext>

      <TablePaginationBar
        loading={loading}
        data={data}
        rangoResultados={rangoResultados}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={tabla.setPage}
        onPageSizeChange={tabla.setPageSize}
        className="mt-2"
      />

      {editOpen && selectedOferta && (
        <EditarOfertaDialog
          oferta={selectedOferta}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleSingleUpdated}
          onImagenUpdated={handleImagenActualizada}
        />
      )}
      <NuevaOfertaDialog open={nuevoOpen} onOpenChange={setNuevoOpen} onCreated={handleCreated} />
      {editOpen && !selectedOferta && tabla.selectedIds.size > 1 && (
        <BulkEditarOfertaDialog
          ids={[...tabla.selectedIds]}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleBulkUpdated}
        />
      )}
      <EliminarOfertasDialog
        ids={[...tabla.selectedIds]}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={handleDeleted}
      />
      {historialOferta && (
        <HistorialOfertaDialog
          oferta={historialOferta}
          open={historialOferta !== null}
          onOpenChange={(next) => {
            if (!next) setHistorialOferta(null);
          }}
        />
      )}
    </>
  );
}
