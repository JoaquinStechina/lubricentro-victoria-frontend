// Verifica el mismo JWT de sesión que emite el backend (Express, repo
// hermano `backend/`) — ambos firman/verifican con el mismo JWT_SECRET.
// Se usa tanto acá (Server Components / Route Handlers, vía `cookies()`)
// como en proxy.ts (que lee la cookie directamente del NextRequest).
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export type Rol = "SYSADMIN" | "ADMINISTRADOR" | "EMPLEADO";

export interface Session {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
}

export const SESSION_COOKIE = "session";

const RANGO: Record<Rol, number> = { EMPLEADO: 1, ADMINISTRADOR: 2, SYSADMIN: 3 };

export function tieneRolMinimo(rol: Rol, minimo: Rol): boolean {
  return RANGO[rol] >= RANGO[minimo];
}

export function verificarToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as unknown as {
      sub: number;
      email: string;
      nombre: string;
      rol: Rol;
    };
    return { id: payload.sub, email: payload.email, nombre: payload.nombre, rol: payload.rol };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return verificarToken(cookieStore.get(SESSION_COOKIE)?.value);
}
