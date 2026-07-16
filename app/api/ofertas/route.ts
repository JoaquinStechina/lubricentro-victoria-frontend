import { NextRequest, NextResponse } from "next/server";
import { getFechasOferta, getMarcasOfertas, queryOfertas } from "@/app/lib/ofertas";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const marca = searchParams.get("marca") || undefined;
  const fechaOferta = searchParams.get("fechaOferta") || undefined;
  const descuentoMinRaw = searchParams.get("descuentoMin");
  const descuentoMin = descuentoMinRaw ? Number(descuentoMinRaw) : undefined;
  const descuentoMaxRaw = searchParams.get("descuentoMax");
  const descuentoMax = descuentoMaxRaw ? Number(descuentoMaxRaw) : undefined;
  const precioMinRaw = searchParams.get("precioMin");
  const precioMin = precioMinRaw ? Number(precioMinRaw) : undefined;
  const precioMaxRaw = searchParams.get("precioMax");
  const precioMax = precioMaxRaw ? Number(precioMaxRaw) : undefined;
  const search = searchParams.get("search") || undefined;
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "50") || 50;

  const result = queryOfertas({
    marca,
    fechaOferta,
    descuentoMin,
    descuentoMax,
    precioMin,
    precioMax,
    search,
    page,
    pageSize,
  });

  return NextResponse.json({
    ...result,
    marcas: getMarcasOfertas(),
    fechasOferta: getFechasOferta(),
  });
}
