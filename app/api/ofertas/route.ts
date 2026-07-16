import { NextRequest, NextResponse } from "next/server";
import { getMarcasOfertas, queryOfertas } from "@/app/lib/ofertas";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const marca = searchParams.get("marca") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "50") || 50;

  const result = queryOfertas({ marca, search, page, pageSize });

  return NextResponse.json({
    ...result,
    marcas: getMarcasOfertas(),
  });
}
