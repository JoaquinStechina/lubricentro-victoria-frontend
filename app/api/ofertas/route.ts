import { NextRequest, NextResponse } from "next/server";
import { queryOfertas, type OfertaColumnKey } from "@/app/lib/ofertas";
import { getSession } from "@/app/lib/session";

const COLUMN_KEYS: OfertaColumnKey[] = [
  "marca",
  "numeroOferta",
  "sku",
  "descripcion",
  "desdeCantidad",
  "descuento",
  "precioUnitario",
  "fechaOferta",
];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") || undefined;
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "50") || 50;

  const columnFilters: Partial<Record<OfertaColumnKey, string>> = {};
  for (const key of COLUMN_KEYS) {
    const value = searchParams.get(`f_${key}`);
    if (value) columnFilters[key] = value;
  }

  const result = queryOfertas({ search, columnFilters, page, pageSize });

  return NextResponse.json(result);
}
