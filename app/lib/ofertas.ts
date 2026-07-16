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

export function getMarcasOfertas(): string[] {
  const ofertas = loadOfertas();
  return Array.from(new Set(ofertas.map((o) => o.marca))).sort();
}

export function getFechasOferta(): string[] {
  const ofertas = loadOfertas();
  return Array.from(new Set(ofertas.map((o) => o.fecha_oferta)))
    .sort()
    .reverse();
}

export type QueryOfertasParams = {
  marca?: string;
  fechaOferta?: string;
  descuentoMin?: number;
  descuentoMax?: number;
  precioMin?: number;
  precioMax?: number;
  search?: string;
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
  marca,
  fechaOferta,
  descuentoMin,
  descuentoMax,
  precioMin,
  precioMax,
  search,
  page,
  pageSize,
}: QueryOfertasParams): QueryOfertasResult {
  const ofertas = loadOfertas();
  const term = search?.trim() ? normalizeText(search.trim()) : undefined;

  const filtered = ofertas.filter((o) => {
    if (marca && o.marca !== marca) return false;
    if (fechaOferta && o.fecha_oferta !== fechaOferta) return false;
    if (descuentoMin !== undefined && o.descuento_pct < descuentoMin)
      return false;
    if (descuentoMax !== undefined && o.descuento_pct > descuentoMax)
      return false;
    if (precioMin !== undefined && o.precio_unitario < precioMin) return false;
    if (precioMax !== undefined && o.precio_unitario > precioMax) return false;
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
