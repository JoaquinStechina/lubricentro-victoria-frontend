import fs from "node:fs";
import path from "node:path";
import { normalizeText } from "@/app/lib/text";

export type Producto = {
  proveedor: string;
  marca: string | null;
  sku_proveedor: string | null;
  sku_interno: string | null;
  descripcion: string | null;
  seccion: string | null;
  precio_neto: number | null;
  precio_con_iva: number | null;
  alicuota_iva: number | null;
  moneda: string | null;
  unidad: string | null;
  fecha_vigencia: string | null;
  raw_data: Record<string, unknown>;
};

let cache: Producto[] | null = null;

function loadProductos(): Producto[] {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "productos_todos.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cache = JSON.parse(raw) as Producto[];
  return cache;
}

export type ProductoColumnKey =
  | "proveedor"
  | "marca"
  | "sku"
  | "descripcion"
  | "seccion"
  | "precioNeto"
  | "precioConIva"
  | "alicuotaIva"
  | "fechaVigencia";

function getColumnValue(p: Producto, key: ProductoColumnKey): string {
  switch (key) {
    case "proveedor":
      return p.proveedor ?? "";
    case "marca":
      return p.marca ?? "";
    case "sku":
      return p.sku_interno ?? p.sku_proveedor ?? "";
    case "descripcion":
      return p.descripcion ?? "";
    case "seccion":
      return p.seccion ?? "";
    case "precioNeto":
      return p.precio_neto !== null ? String(p.precio_neto) : "";
    case "precioConIva":
      return p.precio_con_iva !== null ? String(p.precio_con_iva) : "";
    case "alicuotaIva":
      return p.alicuota_iva !== null ? String(p.alicuota_iva) : "";
    case "fechaVigencia":
      return p.fecha_vigencia ?? "";
  }
}

export type QueryParams = {
  search?: string;
  columnFilters?: Partial<Record<ProductoColumnKey, string>>;
  page: number;
  pageSize: number;
};

export type QueryResult = {
  items: Producto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function queryProductos({
  search,
  columnFilters,
  page,
  pageSize,
}: QueryParams): QueryResult {
  const productos = loadProductos();
  const term = search?.trim() ? normalizeText(search.trim()) : undefined;
  const activeColumnFilters = Object.entries(columnFilters ?? {})
    .filter((entry): entry is [ProductoColumnKey, string] => Boolean(entry[1]?.trim()))
    .map(([key, value]) => [key, normalizeText(value.trim())] as const);

  const filtered = productos.filter((p) => {
    for (const [key, needle] of activeColumnFilters) {
      if (!normalizeText(getColumnValue(p, key)).includes(needle)) return false;
    }
    if (term) {
      const haystack = [
        p.proveedor,
        p.marca,
        p.sku_interno,
        p.sku_proveedor,
        p.descripcion,
        p.seccion,
        p.precio_neto,
        p.precio_con_iva,
        p.alicuota_iva,
        p.moneda,
        p.unidad,
        p.fecha_vigencia,
      ]
        .filter((v) => v !== null && v !== undefined)
        .join(" ");
      if (!normalizeText(haystack).includes(term)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return { items, total, page: safePage, pageSize, totalPages };
}
