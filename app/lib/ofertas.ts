import fs from "node:fs";
import path from "node:path";
import { normalizeText } from "@/app/lib/text";

export type Oferta = {
  id: number;
  proveedor: string;
  marca: string;
  numero_oferta: number;
  sku_proveedor: string;
  descripcion: string;
  desde_cantidad: number;
  descuento_pct: number;
  precio_unitario: number;
  moneda: string;
  fecha_oferta: string;
  hora_oferta: string;
  archivo_origen: string;
  raw_data: Record<string, unknown>;
};

let cache: Oferta[] | null = null;

function loadOfertas(): Oferta[] {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "ofertas.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cache = JSON.parse(raw) as Oferta[];
  return cache;
}

export type OfertaColumnKey =
  | "marca"
  | "numeroOferta"
  | "sku"
  | "descripcion"
  | "desdeCantidad"
  | "descuento"
  | "precioUnitario"
  | "fechaOferta";

function getColumnValue(o: Oferta, key: OfertaColumnKey): string {
  switch (key) {
    case "marca":
      return o.marca ?? "";
    case "numeroOferta":
      return String(o.numero_oferta);
    case "sku":
      return o.sku_proveedor ?? "";
    case "descripcion":
      return o.descripcion ?? "";
    case "desdeCantidad":
      return String(o.desde_cantidad);
    case "descuento":
      return String(o.descuento_pct);
    case "precioUnitario":
      return String(o.precio_unitario);
    case "fechaOferta":
      return o.fecha_oferta ?? "";
  }
}

export type QueryOfertasParams = {
  search?: string;
  columnFilters?: Partial<Record<OfertaColumnKey, string>>;
  page: number;
  pageSize: number;
};

export type QueryOfertasResult = {
  items: Oferta[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function queryOfertas({
  search,
  columnFilters,
  page,
  pageSize,
}: QueryOfertasParams): QueryOfertasResult {
  const ofertas = loadOfertas();
  const term = search?.trim() ? normalizeText(search.trim()) : undefined;
  const activeColumnFilters = Object.entries(columnFilters ?? {})
    .filter((entry): entry is [OfertaColumnKey, string] => Boolean(entry[1]?.trim()))
    .map(([key, value]) => [key, normalizeText(value.trim())] as const);

  const filtered = ofertas.filter((o) => {
    for (const [key, needle] of activeColumnFilters) {
      if (!normalizeText(getColumnValue(o, key)).includes(needle)) return false;
    }
    if (term) {
      const haystack = [
        o.proveedor,
        o.marca,
        o.numero_oferta,
        o.sku_proveedor,
        o.descripcion,
        o.desde_cantidad,
        o.descuento_pct,
        o.precio_unitario,
        o.moneda,
        o.fecha_oferta,
        o.hora_oferta,
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
