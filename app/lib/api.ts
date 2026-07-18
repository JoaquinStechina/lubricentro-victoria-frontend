// Cliente fetch fino hacia el backend (Express, repo hermano `backend/`).
// Fetch directo desde el cliente, sin proxy vía Route Handler: el backend
// ya tiene CORS abierto y no hay nada que ocultar en este prototipo.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Error ${res.status} en ${path}`);
  }
  return res.json() as Promise<T>;
}

export function apiJsonInit(body: unknown, method: "POST" = "POST"): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
