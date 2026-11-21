// Cliente de la tabla de equivalencias (backend: src/routes/equivalencias.ts).
// Los tipos son copias a mano de src/equivalencias/buscar.ts.
import { API_URL, apiFetch, apiJsonInit } from "@/app/lib/api";

export type ProductoEquivalente = {
  id: number;
  proveedor: string;
  marca: string | null;
  codigo: string;
  descripcion: string | null;
  precioSugerido: number | null;
};

export type ExtremoEquivalencia = { marca: string | null; codigo: string };

export type ResultadoEquivalencia = {
  marca: string | null;
  codigo: string;
  marcaNorm: string;
  codigoNorm: string;
  via: ExtremoEquivalencia | null;
  fuente: string;
  confianza: "alta" | "media";
  origen: "auto" | "manual";
  textoOrigen: string | null;
  parId: number;
  // Extremos del lado de lo buscado a los que se llegó; descartar manda cada uno contra el resultado.
  desde: ExtremoEquivalencia[];
  productos: ProductoEquivalente[];
  stock: number | null;
};

export type RespuestaBusqueda = {
  q: string;
  productosBuscados: ProductoEquivalente[];
  equivalencias: ResultadoEquivalencia[];
  ultimaActualizacion: string | null;
};

export type ParEquivalencia = {
  id: number;
  marcaA: string | null;
  codigoA: string;
  marcaANorm: string;
  codigoANorm: string;
  marcaB: string | null;
  codigoB: string;
  marcaBNorm: string;
  codigoBNorm: string;
  fuente: string;
  confianza: "alta" | "media";
  origen: "auto" | "manual";
  textoOrigen: string | null;
  createdAt: string;
};

export type DescarteEquivalencia = {
  id: number;
  marcaANorm: string;
  codigoANorm: string;
  marcaBNorm: string;
  codigoBNorm: string;
  marcaA: string | null;
  codigoA: string;
  marcaB: string | null;
  codigoB: string;
  createdAt: string;
};

export type EstadoEquivalencias = {
  ultimaActualizacion: string | null;
  pares: number;
  corriendo: boolean;
  ultimoError: string | null;
};

export type ExtremoEntrada = { marca?: string | null; codigo: string };

const BASE = "/api/equivalencias";

// Misma regla que el backend (codigoBuscado): código normalizado como
// normalizarCodigo (mayúsculas, sin espacios, guiones, puntos ni barras), con
// al menos 3 caracteres y un dígito.
export function esCodigoBuscable(q: string): boolean {
  const codigo = q.toUpperCase().replace(/[\s\-./]/g, "");
  return codigo.length >= 3 && /\d/.test(codigo);
}

// Los DELETE contestan 204 sin cuerpo: apiFetch haría res.json() y fallaría.
async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Error ${res.status} en ${path}`);
  }
}

export function buscarEquivalencias(q: string, signal?: AbortSignal): Promise<RespuestaBusqueda> {
  return apiFetch<RespuestaBusqueda>(`${BASE}/buscar?q=${encodeURIComponent(q)}`, { signal });
}

function cuerpoPar(a: ExtremoEntrada, b: ExtremoEntrada) {
  return { marcaA: a.marca ?? "", codigoA: a.codigo, marcaB: b.marca ?? "", codigoB: b.codigo };
}

export function agregarEquivalencia(a: ExtremoEntrada, b: ExtremoEntrada): Promise<ParEquivalencia> {
  return apiFetch<ParEquivalencia>(`${BASE}`, apiJsonInit(cuerpoPar(a, b)));
}

export function descartarEquivalencia(a: ExtremoEntrada, b: ExtremoEntrada): Promise<DescarteEquivalencia> {
  return apiFetch<DescarteEquivalencia>(`${BASE}/descartar`, apiJsonInit(cuerpoPar(a, b)));
}

// Descarta el resultado contra cada extremo desde el que se llegó a él.
export async function descartarResultado(r: ResultadoEquivalencia): Promise<void> {
  for (const desde of r.desde) {
    await descartarEquivalencia(desde, { marca: r.marca, codigo: r.codigo });
  }
}

export function borrarEquivalencia(id: number): Promise<void> {
  return apiDelete(`${BASE}/${id}`);
}

export function restaurarDescarte(id: number): Promise<void> {
  return apiDelete(`${BASE}/descartes/${id}`);
}

export async function listarManuales(): Promise<ParEquivalencia[]> {
  return (await apiFetch<{ items: ParEquivalencia[] }>(`${BASE}/manuales`)).items;
}

export async function listarDescartes(): Promise<DescarteEquivalencia[]> {
  return (await apiFetch<{ items: DescarteEquivalencia[] }>(`${BASE}/descartes`)).items;
}

export function estadoEquivalencias(): Promise<EstadoEquivalencias> {
  return apiFetch<EstadoEquivalencias>(`${BASE}/estado`);
}

export function recalcularEquivalencias(): Promise<{ pares: number }> {
  return apiFetch<{ pares: number }>(`${BASE}/recalcular`, { method: "POST" });
}
