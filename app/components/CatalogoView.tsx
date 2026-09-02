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
import type { Producto, ProductoColumnKey } from "@/app/lib/productos";
import { useColumnPrefs } from "@/app/lib/useColumnPrefs";
import { useTablaRecurso } from "@/app/lib/useTablaRecurso";
import ColumnFilterHeader from "@/app/components/ColumnFilterHeader";
import ColumnVisibilityMenu, { type ColumnOption } from "@/app/components/ColumnVisibilityMenu";
import ExportarButton from "@/app/components/ExportarButton";
import HighlightText from "@/app/components/HighlightText";
import SortableResizableHead from "@/app/components/SortableResizableHead";
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
  { key: "skuProveedor", label: "SKU proveedor" },
  { key: "descripcion", label: "Descripción" },
  { key: "seccion", label: "Sección" },
  { key: "precioNeto", label: "Precio neto" },
  { key: "precioConIva", label: "Precio Neto C/IVA" },
  { key: "precioLista", label: "Precio Lista" },
  { key: "precioListaConIva", label: "Precio Lista C/IVA" },
  { key: "precioSugerido", label: "Precio Sugerido" },
  { key: "alicuotaIva", label: "IVA %" },
  { key: "fechaVigencia", label: "Vigencia" },
];
const CATALOGO_DEFAULT_COLUMN_ORDER = CATALOGO_COLUMN_OPTIONS.map((c) => c.key);

// Ancho inicial (px) de cada columna de datos — el usuario lo puede
// arrastrar desde ahí (ver SortableResizableHead); doble click en el
// handle de resize vuelve a este valor.
const CATALOGO_DEFAULT_WIDTHS: Record<string, number> = {
  proveedor: 140,
  marca: 130,
  sku: 130,
  skuProveedor: 130,
  descripcion: 260,
  seccion: 130,
  precioNeto: 120,
  precioConIva: 140,
  precioLista: 120,
  precioListaConIva: 140,
  precioSugerido: 130,
  alicuotaIva: 80,
  fechaVigencia: 110,
};

const EMPTY_COLUMN_FILTERS: Record<ProductoColumnKey, string> = {
  proveedor: "",
  marca: "",
  sku: "",
  skuProveedor: "",
  descripcion: "",
  seccion: "",
  precioNetoMin: "",
  precioNetoMax: "",
  precioConIvaMin: "",
  precioConIvaMax: "",
  precioListaMin: "",
  precioListaMax: "",
  precioListaConIvaMin: "",
  precioListaConIvaMax: "",
  precioSugeridoMin: "",
  precioSugeridoMax: "",
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

// IVA % no es moneda (no pasa por currencyFormatter): igual se limita a 2
// decimales acá, la fuente de verdad es el redondeo que ya hace el backend
// al guardar, esto solo cubre datos viejos que hayan quedado con más.
function formatPorcentaje(valor: number | null) {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(valor);
}

export default function CatalogoView() {
  const tabla = useTablaRecurso({
    filtrosIniciales: EMPTY_COLUMN_FILTERS,
    pageSizeInicial: PAGE_SIZES[0],
  });
  const [restaurando, setRestaurando] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

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

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [historialProducto, setHistorialProducto] = useState<Producto | null>(null);

  const {
    order: columnOrder,
    hidden: hiddenColumns,
    widths: columnWidths,
    setOrder: setColumnOrder,
    toggleColumn,
    setWidth: setColumnWidth,
    reset: resetColumnPrefs,
  } = useColumnPrefs("lv:columnas:catalogo", CATALOGO_DEFAULT_COLUMN_ORDER);

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

  useEffect(() => {
    let active = true;
    const params = tabla.buildParams(true);

    async function load() {
      setLoading(true);
      try {
        const json = await apiFetch<ApiResponse>(`/api/productos?${params.toString()}`);
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
  }, [tabla.fetchKey]);

  // Mismos filtros/orden que la tabla, sin page/pageSize: el export baja el
  // resultado completo (ver GET /api/productos/export).
  const buildExportParams = () => tabla.buildParams(false);

  async function restaurarSeleccion() {
    setRestaurando(true);
    try {
      await apiFetch(`/api/productos/restaurar`, apiJsonInit({ ids: [...tabla.selectedIds] }));
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

  const visibleIds = data?.items.map((p) => p.id) ?? [];
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => tabla.selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => tabla.selectedIds.has(id));

  const selectedProducto =
    tabla.selectedIds.size === 1 ? (data?.items.find((p) => tabla.selectedIds.has(p.id)) ?? null) : null;

  function handleSingleUpdated(actualizado: Producto) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((p) => (p.id === actualizado.id ? actualizado : p)) } : prev
    );
    tabla.clearSelection();
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
    tabla.clearSelection();
    tabla.recargar();
  }
  function handleCreated() {
    tabla.setPage(1);
    tabla.recargar();
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
    tabla.clearSelection();
  }

  // Cada entrada envuelve exactamente el mismo JSX que antes estaba
  // hardcodeado en el header/las filas — ver mismo patrón en OfertasView.tsx.
  const columnDefsByKey: Record<string, { header: () => ReactNode; cell: (producto: Producto) => ReactNode }> = {
    proveedor: {
      header: () => (
        <SortableResizableHead
          columnKey="proveedor"
          width={columnWidths.proveedor ?? CATALOGO_DEFAULT_WIDTHS.proveedor}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.proveedor}
          onResize={(px) => setColumnWidth("proveedor", px)}
        >
          <ColumnFilterHeader
            label="Proveedor"
            value={tabla.columnFilters.proveedor}
            onChange={(v) => tabla.setColumnFilter("proveedor", v)}
            sortDirection={tabla.sort?.campo === "proveedor" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("proveedor")}
          />
        </SortableResizableHead>
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
        <SortableResizableHead
          columnKey="marca"
          width={columnWidths.marca ?? CATALOGO_DEFAULT_WIDTHS.marca}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.marca}
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
      cell: (producto) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={producto.marca ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
    sku: {
      header: () => (
        <SortableResizableHead
          columnKey="sku"
          width={columnWidths.sku ?? CATALOGO_DEFAULT_WIDTHS.sku}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.sku}
          onResize={(px) => setColumnWidth("sku", px)}
        >
          <ColumnFilterHeader
            label="SKU interno"
            value={tabla.columnFilters.sku}
            onChange={(v) => tabla.setColumnFilter("sku", v)}
            sortDirection={tabla.sort?.campo === "sku" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("sku")}
          />
        </SortableResizableHead>
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
    skuProveedor: {
      header: () => (
        <SortableResizableHead
          columnKey="skuProveedor"
          width={columnWidths.skuProveedor ?? CATALOGO_DEFAULT_WIDTHS.skuProveedor}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.skuProveedor}
          onResize={(px) => setColumnWidth("skuProveedor", px)}
        >
          <ColumnFilterHeader
            label="SKU proveedor"
            value={tabla.columnFilters.skuProveedor}
            onChange={(v) => tabla.setColumnFilter("skuProveedor", v)}
            sortDirection={tabla.sort?.campo === "skuProveedor" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("skuProveedor")}
          />
        </SortableResizableHead>
      ),
      cell: (producto) => (
        <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          <HighlightText text={producto.skuProveedor ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
    descripcion: {
      header: () => (
        <SortableResizableHead
          columnKey="descripcion"
          width={columnWidths.descripcion ?? CATALOGO_DEFAULT_WIDTHS.descripcion}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.descripcion}
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
      cell: (producto) => (
        <TableCell className="whitespace-normal text-zinc-900 dark:text-zinc-100">
          <HighlightText text={producto.descripcion ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
    seccion: {
      header: () => (
        <SortableResizableHead
          columnKey="seccion"
          width={columnWidths.seccion ?? CATALOGO_DEFAULT_WIDTHS.seccion}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.seccion}
          onResize={(px) => setColumnWidth("seccion", px)}
        >
          <ColumnFilterHeader
            label="Sección"
            value={tabla.columnFilters.seccion}
            onChange={(v) => tabla.setColumnFilter("seccion", v)}
            searchOptions={secciones}
            sortDirection={tabla.sort?.campo === "seccion" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("seccion")}
          />
        </SortableResizableHead>
      ),
      cell: (producto) => (
        <TableCell className="text-zinc-700 dark:text-zinc-300">
          <HighlightText text={producto.seccion ?? "—"} query={debouncedSearch} />
        </TableCell>
      ),
    },
    precioNeto: {
      header: () => (
        <SortableResizableHead
          columnKey="precioNeto"
          width={columnWidths.precioNeto ?? CATALOGO_DEFAULT_WIDTHS.precioNeto}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.precioNeto}
          onResize={(px) => setColumnWidth("precioNeto", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Precio neto"
            value=""
            onChange={() => {}}
            rangeValue={{ min: tabla.columnFilters.precioNetoMin, max: tabla.columnFilters.precioNetoMax }}
            onRangeChange={(min, max) => {
              tabla.setColumnFilter("precioNetoMin", min);
              tabla.setColumnFilter("precioNetoMax", max);
            }}
            align="right"
            sortDirection={tabla.sort?.campo === "precioNeto" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("precioNeto")}
          />
        </SortableResizableHead>
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
          <HighlightText text={formatPrecio(producto.precioNeto)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    precioConIva: {
      header: () => (
        <SortableResizableHead
          columnKey="precioConIva"
          width={columnWidths.precioConIva ?? CATALOGO_DEFAULT_WIDTHS.precioConIva}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.precioConIva}
          onResize={(px) => setColumnWidth("precioConIva", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Precio Neto C/IVA"
            value=""
            onChange={() => {}}
            rangeValue={{
              min: tabla.columnFilters.precioConIvaMin,
              max: tabla.columnFilters.precioConIvaMax,
            }}
            onRangeChange={(min, max) => {
              tabla.setColumnFilter("precioConIvaMin", min);
              tabla.setColumnFilter("precioConIvaMax", max);
            }}
            align="right"
            sortDirection={tabla.sort?.campo === "precioConIva" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("precioConIva")}
          />
        </SortableResizableHead>
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
          <HighlightText text={formatPrecio(producto.precioConIva)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    precioLista: {
      header: () => (
        <SortableResizableHead
          columnKey="precioLista"
          width={columnWidths.precioLista ?? CATALOGO_DEFAULT_WIDTHS.precioLista}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.precioLista}
          onResize={(px) => setColumnWidth("precioLista", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Precio Lista"
            value=""
            onChange={() => {}}
            rangeValue={{
              min: tabla.columnFilters.precioListaMin,
              max: tabla.columnFilters.precioListaMax,
            }}
            onRangeChange={(min, max) => {
              tabla.setColumnFilter("precioListaMin", min);
              tabla.setColumnFilter("precioListaMax", max);
            }}
            align="right"
            sortDirection={tabla.sort?.campo === "precioLista" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("precioLista")}
          />
        </SortableResizableHead>
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
          <HighlightText text={formatPrecio(producto.precioLista)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    precioListaConIva: {
      header: () => (
        <SortableResizableHead
          columnKey="precioListaConIva"
          width={columnWidths.precioListaConIva ?? CATALOGO_DEFAULT_WIDTHS.precioListaConIva}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.precioListaConIva}
          onResize={(px) => setColumnWidth("precioListaConIva", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Precio Lista C/IVA"
            value=""
            onChange={() => {}}
            rangeValue={{
              min: tabla.columnFilters.precioListaConIvaMin,
              max: tabla.columnFilters.precioListaConIvaMax,
            }}
            onRangeChange={(min, max) => {
              tabla.setColumnFilter("precioListaConIvaMin", min);
              tabla.setColumnFilter("precioListaConIvaMax", max);
            }}
            align="right"
            sortDirection={tabla.sort?.campo === "precioListaConIva" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("precioListaConIva")}
          />
        </SortableResizableHead>
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
          <HighlightText text={formatPrecio(producto.precioListaConIva)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    precioSugerido: {
      header: () => (
        <SortableResizableHead
          columnKey="precioSugerido"
          width={columnWidths.precioSugerido ?? CATALOGO_DEFAULT_WIDTHS.precioSugerido}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.precioSugerido}
          onResize={(px) => setColumnWidth("precioSugerido", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="Precio Sugerido"
            value=""
            onChange={() => {}}
            rangeValue={{
              min: tabla.columnFilters.precioSugeridoMin,
              max: tabla.columnFilters.precioSugeridoMax,
            }}
            onRangeChange={(min, max) => {
              tabla.setColumnFilter("precioSugeridoMin", min);
              tabla.setColumnFilter("precioSugeridoMax", max);
            }}
            align="right"
            sortDirection={tabla.sort?.campo === "precioSugerido" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("precioSugerido")}
          />
        </SortableResizableHead>
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
          <HighlightText text={formatPrecio(producto.precioSugerido)} query={debouncedSearch} />
        </TableCell>
      ),
    },
    alicuotaIva: {
      header: () => (
        <SortableResizableHead
          columnKey="alicuotaIva"
          width={columnWidths.alicuotaIva ?? CATALOGO_DEFAULT_WIDTHS.alicuotaIva}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.alicuotaIva}
          onResize={(px) => setColumnWidth("alicuotaIva", px)}
          align="right"
        >
          <ColumnFilterHeader
            label="IVA %"
            value={tabla.columnFilters.alicuotaIva}
            onChange={(v) => tabla.setColumnFilter("alicuotaIva", v)}
            align="right"
            sortDirection={tabla.sort?.campo === "alicuotaIva" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("alicuotaIva")}
          />
        </SortableResizableHead>
      ),
      cell: (producto) => (
        <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
          <HighlightText
            text={formatPorcentaje(producto.alicuotaIva)}
            query={debouncedSearch}
          />
        </TableCell>
      ),
    },
    fechaVigencia: {
      header: () => (
        <SortableResizableHead
          columnKey="fechaVigencia"
          width={columnWidths.fechaVigencia ?? CATALOGO_DEFAULT_WIDTHS.fechaVigencia}
          defaultWidth={CATALOGO_DEFAULT_WIDTHS.fechaVigencia}
          onResize={(px) => setColumnWidth("fechaVigencia", px)}
        >
          <ColumnFilterHeader
            label="Vigencia"
            value={tabla.columnFilters.fechaVigencia}
            onChange={(v) => tabla.setColumnFilter("fechaVigencia", v)}
            sortDirection={tabla.sort?.campo === "fechaVigencia" ? tabla.sort.order : null}
            onSortToggle={() => tabla.toggleSort("fechaVigencia")}
          />
        </SortableResizableHead>
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

  const colSpan = 1 + 1 + visibleColumnDefs.length + 1;

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
              value={tabla.search}
              onChange={(e) => tabla.setSearch(e.target.value)}
              placeholder="Ej: 2351, filtro de aceite, Bosch, Vigencia..."
            />
          </div>

          {tabla.hayFiltrosActivos && (
            <Button variant="outline" onClick={tabla.limpiarFiltros}>
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
          <Button onClick={() => setNuevoOpen(true)}>
            <Plus className="size-3.5" />
            Nuevo producto
          </Button>
        </div>
        <div className="flex items-center gap-5 text-sm">
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
            {tabla.selectedIds.size} seleccionada{tabla.selectedIds.size > 1 ? "s" : ""}
          </span>
          {tabla.verEliminados ? (
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={tabla.selectedIds.has(producto.id)}
                        onCheckedChange={() => tabla.toggleRow(producto.id)}
                        aria-label="Seleccionar fila"
                      />
                    </TableCell>
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
      {editOpen && !selectedProducto && tabla.selectedIds.size > 1 && (
        <BulkEditarProductoDialog
          ids={[...tabla.selectedIds]}
          open={editOpen}
          onOpenChange={setEditOpen}
          onUpdated={handleBulkUpdated}
        />
      )}
      <EliminarProductosDialog
        ids={[...tabla.selectedIds]}
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
