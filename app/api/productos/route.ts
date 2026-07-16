import { NextRequest, NextResponse } from "next/server";
import { getMarcas, getProveedores, queryProductos } from "@/app/lib/productos";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const proveedor = searchParams.get("proveedor") || undefined;
  const marca = searchParams.get("marca") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "50") || 50;

  const result = queryProductos({ proveedor, marca, search, page, pageSize });

  return NextResponse.json({
    ...result,
    proveedores: getProveedores(),
    marcas: getMarcas(proveedor),
  });
}
