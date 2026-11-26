// Sesión del sistema: la API pide una clave (backend: docs/acceso.md) y deja
// una cookie httpOnly. El frontend nunca ve la cookie; solo reacciona al 401.
//
// TODO pedido a la API pasa por `fetchApi`: manda la cookie (`credentials:
// "include"`, necesario en desarrollo, donde la API está en otro puerto) y,
// ante un 401, lleva a /entrar?volver=<página actual>. Así un fetch nuevo no
// puede "olvidarse" de la sesión vencida.

import { API_URL } from "@/app/lib/apiUrl";

export const RUTA_ENTRAR = "/entrar";

export const MENSAJE_SESION_VENCIDA = "Tu sesión venció. Te llevamos a la pantalla para entrar…";

// Varias llamadas pueden recibir 401 a la vez (una página carga varias cosas):
// se navega una sola vez.
let redirigiendo = false;

/**
 * Destino seguro para después de entrar: solo una ruta de este mismo sitio.
 * Cualquier otra cosa ("//otro.sitio", "https://…", "javascript:…") vuelve
 * al inicio: el valor llega por la URL y no se puede confiar en él.
 */
export function volverSeguro(valor: string | null | undefined): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(valor)) return "/";
  try {
    const base = "http://local.invalid";
    const u = new URL(valor, base);
    if (u.origin !== base) return "/";
    const ruta = `${u.pathname}${u.search}${u.hash}`;
    return u.pathname === RUTA_ENTRAR ? "/" : ruta;
  } catch {
    return "/";
  }
}

/** URL de la pantalla de entrar que, al terminar, vuelve a `ruta`. */
export function urlEntrar(ruta: string): string {
  const destino = volverSeguro(ruta);
  return destino === "/" ? RUTA_ENTRAR : `${RUTA_ENTRAR}?volver=${encodeURIComponent(destino)}`;
}

/** Lleva a /entrar recordando la página actual. Navegación completa: descarta el estado en memoria. */
export function irAEntrar(): void {
  if (typeof window === "undefined" || redirigiendo) return;
  if (window.location.pathname === RUTA_ENTRAR) return;
  redirigiendo = true;
  window.location.assign(urlEntrar(`${window.location.pathname}${window.location.search}`));
}

/** Error que lanza `fetchApi` ante un 401: la página ya se está yendo a /entrar. */
export class SesionVencida extends Error {
  constructor() {
    super(MENSAJE_SESION_VENCIDA);
    this.name = "SesionVencida";
  }
}

// Las rutas de /api/acceso son las de entrar y salir: un 401 ahí (clave
// incorrecta) lo maneja la pantalla, no se redirige.
function esRutaDeAcceso(path: string): boolean {
  return path.startsWith("/api/acceso/");
}

/**
 * fetch hacia la API con la cookie de sesión. Ante un 401 lleva a /entrar y
 * lanza `SesionVencida` (quien llama ve un error y no sigue). Los errores de
 * red se propagan igual que con fetch.
 */
export async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  if (res.status === 401 && !esRutaDeAcceso(path)) {
    irAEntrar();
    throw new SesionVencida();
  }
  return res;
}

export type EstadoSesion = { requiereClave: boolean; autenticado: boolean; problema: string | null };

/** GET /api/acceso/estado, o null si la API no lo tiene o no responde. */
export async function estadoSesion(): Promise<EstadoSesion | null> {
  try {
    const res = await fetchApi("/api/acceso/estado", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as EstadoSesion;
  } catch {
    return null;
  }
}

/**
 * Abre el PDF de un comprobante en otra pestaña. Es un link a la API (no un
 * fetch), así que el navegador manda la cookie solo; pero si la sesión venció,
 * la pestaña nueva mostraría un error en JSON. Se abre la pestaña en el clic
 * (si no, el navegador la bloquea), se confirma la sesión y recién ahí se
 * carga el PDF; sin sesión, se cierra y se va a /entrar.
 */
export async function abrirPdf(path: string): Promise<void> {
  const pestania = window.open("", "_blank");
  const estado = await estadoSesion();
  if (estado && estado.requiereClave && !estado.autenticado) {
    pestania?.close();
    irAEntrar();
    return;
  }
  const url = `${API_URL}${path}`;
  if (pestania) pestania.location.href = url;
  else window.location.assign(url);
}
