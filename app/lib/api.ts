// Cliente fetch fino hacia el backend (Express, repo hermano `backend/`).
// Fetch directo desde el cliente, sin proxy vía Route Handler.
// ping-pipeline-1784735891: commit de prueba para el deploy automatico
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Error ${res.status} en ${path}`);
  }
  return res.json() as Promise<T>;
}

// Arma la URL absoluta de una imagen servida por el backend (imagenUrl es
// una ruta relativa, ej. "/uploads/imagenes/xxx.jpg", ver GET estático en
// backend/src/server.ts). null/"" -> undefined, para poder pasarlo directo
// a <img src>.
export function imagenSrc(path: string | null): string | undefined {
  return path ? `${API_URL}${path}` : undefined;
}

export function apiJsonInit(body: unknown, method: "POST" | "PATCH" = "POST"): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Descarga un archivo del backend (ej. GET /api/productos/export). apiFetch
// no sirve acá: siempre hace res.json(). El nombre final lo decide el
// backend vía Content-Disposition, pero el atributo download necesita un
// fallback por si ese header no llega al <a> (con blob: no viaja).
export async function apiDownload(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Error ${res.status} en ${path}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
