import { NextRequest, NextResponse } from "next/server";
import { queryProductos, type ProductoColumnKey } from "@/app/lib/productos";

const COLUMN_KEYS: ProductoColumnKey[] = [
  "proveedor",
  "marca",
  "sku",
  "descripcion",
  "seccion",
  "precioNeto",
  "precioConIva",
  "alicuotaIva",
  "fechaVigencia",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || undefined;
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "50") || 50;

  const columnFilters: Partial<Record<ProductoColumnKey, string>> = {};
  for (const key of COLUMN_KEYS) {
    const value = searchParams.get(`f_${key}`);
    if (value) columnFilters[key] = value;
  }

  const result = queryProductos({ search, columnFilters, page, pageSize });

  return NextResponse.json(result);
}
