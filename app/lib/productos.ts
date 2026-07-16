import fs from "node:fs";
import path from "node:path";

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

export function getProveedores(): string[] {
  const productos = loadProductos();
  return Array.from(new Set(productos.map((p) => p.proveedor))).sort();
}

export function getMarcas(proveedor?: string): string[] {
  const productos = loadProductos();
  const marcas = productos
    .filter((p) => !proveedor || p.proveedor === proveedor)
    .map((p) => p.marca)
    .filter((m): m is string => Boolean(m));
  return Array.from(new Set(marcas)).sort();
}

export function getSecciones(): string[] {
  const productos = loadProductos();
  const secciones = productos
    .map((p) => p.seccion)
    .filter((s): s is string => Boolean(s));
  return Array.from(new Set(secciones)).sort();
}

export function getFechasVigencia(): string[] {
  const productos = loadProductos();
  const fechas = productos
    .map((p) => p.fecha_vigencia)
    .filter((f): f is string => Boolean(f));
  return Array.from(new Set(fechas)).sort().reverse();
}

export function getAlicuotasIva(): number[] {
  const productos = loadProductos();
  const alicuotas = productos
    .map((p) => p.alicuota_iva)
    .filter((a): a is number => a !== null && a !== undefined);
  return Array.from(new Set(alicuotas)).sort((a, b) => a - b);
}

export type QueryParams = {
  proveedor?: string;
  marca?: string;
  seccion?: string;
  fechaVigencia?: string;
  alicuotaIva?: number;
  precioMin?: number;
  precioMax?: number;
  search?: string;
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
  proveedor,
  marca,
  seccion,
  fechaVigencia,
  alicuotaIva,
  precioMin,
  precioMax,
  search,
  page,
  pageSize,
}: QueryParams): QueryResult {
  const productos = loadProductos();
  const term = search?.trim().toLowerCase();

  const filtered = productos.filter((p) => {
    if (proveedor && p.proveedor !== proveedor) return false;
    if (marca && p.marca !== marca) return false;
    if (seccion && p.seccion !== seccion) return false;
    if (fechaVigencia && p.fecha_vigencia !== fechaVigencia) return false;
    if (alicuotaIva !== undefined && p.alicuota_iva !== alicuotaIva)
      return false;
    if (precioMin !== undefined && (p.precio_neto === null || p.precio_neto < precioMin))
      return false;
    if (precioMax !== undefined && (p.precio_neto === null || p.precio_neto > precioMax))
      return false;
    if (term) {
      const haystack = `${p.sku_interno ?? ""} ${p.sku_proveedor ?? ""} ${
        p.descripcion ?? ""
      }`.toLowerCase();
      if (!haystack.includes(term)) return false;
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
