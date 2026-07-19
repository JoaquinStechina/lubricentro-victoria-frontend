// Next.js 16 renombró `middleware.ts` a `proxy.ts` (el archivo
// `middleware.ts` está deprecado). Ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, tieneRolMinimo, verificarToken, type Rol } from "@/app/lib/session";

const RUTAS_PUBLICAS = ["/login"];

// Prefijo de ruta -> rol mínimo requerido para entrar. Se evalúa en orden;
// cualquier ruta no listada acá solo requiere estar logueado (EMPLEADO).
const RUTAS_PROTEGIDAS: { prefijo: string; minimo: Rol }[] = [
  { prefijo: "/usuarios", minimo: "SYSADMIN" },
  { prefijo: "/cargas", minimo: "ADMINISTRADOR" },
];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (RUTAS_PUBLICAS.some((ruta) => pathname === ruta)) {
    return NextResponse.next();
  }

  const session = verificarToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const restriccion = RUTAS_PROTEGIDAS.find((r) => pathname.startsWith(r.prefijo));
  if (restriccion && !tieneRolMinimo(session.rol, restriccion.minimo)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
