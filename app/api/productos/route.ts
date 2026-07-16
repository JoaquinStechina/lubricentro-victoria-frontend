import { NextRequest, NextResponse } from "next/server";
import {
  getAlicuotasIva,
  getFechasVigencia,
  getMarcas,
  getProveedores,
  getSecciones,
  queryProductos,
} from "@/app/lib/productos";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const proveedor = searchParams.get("proveedor") || undefined;
  const marca = searchParams.get("marca") || undefined;
  const seccion = searchParams.get("seccion") || undefined;
  const fechaVigencia = searchParams.get("fechaVigencia") || undefined;
  const alicuotaIvaRaw = searchParams.get("alicuotaIva");
  const alicuotaIva = alicuotaIvaRaw ? Number(alicuotaIvaRaw) : undefined;
  const precioMinRaw = searchParams.get("precioMin");
  const precioMin = precioMinRaw ? Number(precioMinRaw) : undefined;
  const precioMaxRaw = searchParams.get("precioMax");
  const precioMax = precioMaxRaw ? Number(precioMaxRaw) : undefined;
  const search = searchParams.get("search") || undefined;
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "50") || 50;

  const result = queryProductos({
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
  });

  return NextResponse.json({
    ...result,
    proveedores: getProveedores(),
    marcas: getMarcas(proveedor),
    secciones: getSecciones(),
    fechasVigencia: getFechasVigencia(),
    alicuotasIva: getAlicuotasIva(),
  });
}
