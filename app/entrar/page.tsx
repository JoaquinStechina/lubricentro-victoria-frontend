"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockIcon } from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { estadoSesion, fetchApi, volverSeguro } from "@/app/lib/sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Pantalla para entrar al sistema: una sola clave, sin usuario. Al entrar
// vuelve a la página de `?volver=` (solo rutas de este sitio: volverSeguro).
function FormularioEntrar() {
  const router = useRouter();
  const destino = volverSeguro(useSearchParams().get("volver"));
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Si ya hay sesión (otra pestaña entró, o la API no pide clave), no hay nada
  // que hacer acá. Si la API avisa que el acceso no está configurado, se muestra.
  useEffect(() => {
    let activo = true;
    void estadoSesion().then((estado) => {
      if (!activo || !estado) return;
      if (estado.autenticado) router.replace(destino);
      else if (estado.problema) setAviso(estado.problema);
    });
    return () => {
      activo = false;
    };
  }, [router, destino]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (clave === "") {
      setError("Escribí la clave.");
      campo.current?.focus();
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetchApi("/api/acceso/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      if (res.ok) {
        setClave("");
        router.replace(destino);
        return;
      }
      const cuerpo = (await res.json().catch(() => null)) as { error?: unknown } | null;
      const mensaje =
        typeof cuerpo?.error === "string" && cuerpo.error
          ? cuerpo.error
          : `El servidor no respondió como se esperaba (código ${res.status}). Probá de nuevo en unos minutos.`;
      setError(mensaje);
      setClave("");
      campo.current?.focus();
    } catch {
      setError("No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={(e) => void entrar(e)} className="flex flex-col gap-4" noValidate>
      {aviso && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          No se puede entrar: el acceso al sistema no está configurado ({aviso}).
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="clave">Clave</Label>
        <Input
          id="clave"
          ref={campo}
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? "error-clave" : undefined}
          disabled={enviando}
        />
      </div>
      {error && (
        <p id="error-clave" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

export default function EntrarPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-10 dark:bg-black">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <main className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
            <LockIcon className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-sm text-muted-foreground">Lubricentro Victoria</p>
        </div>
        {/* useSearchParams necesita un Suspense para que el build pueda prerenderizar la página. */}
        <Suspense fallback={null}>
          <FormularioEntrar />
        </Suspense>
      </main>
    </div>
  );
}
