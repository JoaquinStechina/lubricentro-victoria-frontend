import fs from "node:fs";
import path from "node:path";

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

export type QueryOfertasParams = {
  marca?: string;
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
  search,
  page,
  pageSize,
}: QueryOfertasParams): QueryOfertasResult {
  const ofertas = loadOfertas();
  const term = search?.trim().toLowerCase();

  const filtered = ofertas.filter((o) => {
    if (marca && o.marca !== marca) return false;
    if (term) {
      const haystack = `${o.sku_proveedor} ${o.descripcion}`.toLowerCase();
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
