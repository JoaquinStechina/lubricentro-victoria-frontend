// Cliente fetch fino hacia el backend (Express, repo hermano `backend/`).
// Fetch directo desde el cliente, sin proxy vía Route Handler.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // credentials: "include" es necesario para que la cookie httpOnly de
  // sesión viaje en las llamadas cross-origin (3000 -> 4000).
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    // No hay nada útil que devolver: la navegación ya está en curso.
    return new Promise<T>(() => {});
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Error ${res.status} en ${path}`);
  }
  return res.json() as Promise<T>;
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
  const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    return new Promise<void>(() => {});
  }
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
