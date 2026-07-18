"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import type { Carga } from "@/app/lib/cargas";
import ReviewTable from "@/app/components/cargas/ReviewTable";
import { Button } from "@/components/ui/button";

const LOADER_STAGES = [
  { afterSeconds: 0, message: "Subiendo y preparando el archivo…" },
  { afterSeconds: 3, message: "Extrayendo datos con IA… puede tardar hasta 2 minutos" },
  { afterSeconds: 30, message: "Sigue extrayendo — archivos grandes tardan más…" },
];

function Loader() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const stage = [...LOADER_STAGES].reverse().find((s) => elapsed >= s.afterSeconds)!;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <Loader2Icon className="size-8 animate-spin text-primary" />
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{stage.message}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-500">{elapsed}s</p>
    </div>
  );
}

export default function CargaWizardPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [carga, setCarga] = useState<Carga | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const procesarDisparado = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiFetch<Carga>(`/api/uploads/${id}`);
        if (active) setCarga(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  // Si la carga está recién creada, dispara el procesamiento automáticamente
  // (el usuario ya "subió" el archivo en /cargas; acá arranca el loader).
  // Mientras esta llamada está en vuelo, `carga.estado` sigue en "pendiente"
  // (no se pisa localmente), así que el Loader de abajo sigue mostrándose
  // sin necesidad de un estado extra.
  useEffect(() => {
    if (!carga || carga.estado !== "pendiente" || procesarDisparado.current) return;
    procesarDisparado.current = true;
    let active = true;
    async function disparar() {
      try {
        const data = await apiFetch<Carga>(`/api/uploads/${id}/procesar`, { method: "POST" });
        if (active) setCarga(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : String(err));
      }
    }
    disparar();
    return () => {
      active = false;
    };
  }, [carga, id]);

  function reintentar() {
    procesarDisparado.current = false;
    if (carga) setCarga({ ...carga, estado: "pendiente" });
  }

  if (loadError && !carga) {
    return (
      <Wrapper>
        <p className="text-sm text-destructive">{loadError}</p>
      </Wrapper>
    );
  }

  if (!carga) {
    return (
      <Wrapper>
        <Loader />
      </Wrapper>
    );
  }

  return (
    <Wrapper carga={carga}>
      {(carga.estado === "pendiente" || carga.estado === "procesando") && <Loader />}

      {(carga.estado === "revision_pendiente" || carga.estado === "confirmacion_pendiente") && (
        <>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            {carga.estado === "revision_pendiente"
              ? "Proveedor nuevo (o le cambiaron las columnas): revisá el mapeo sugerido por la IA y los valores antes de confirmar."
              : "Este proveedor ya tiene un mapeo aprobado — revisá los valores extraídos y confirmá para guardarlos."}
          </p>
          <ReviewTable carga={carga} onConfirmed={setCarga} />
        </>
      )}

      {carga.estado === "completado" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <CheckCircle2Icon className="size-8 text-green-600 dark:text-green-500" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Carga confirmada y guardada.</p>
          <div className="mt-2 flex gap-2">
            <Link href="/cargas">
              <Button variant="outline">Ver cargas</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Ir al catálogo</Button>
            </Link>
          </div>
        </div>
      )}

      {carga.estado === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <XCircleIcon className="size-8 text-destructive" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {carga.mensajeError ?? "Ocurrió un error al procesar la carga."}
          </p>
          <Button onClick={reintentar}>Reintentar</Button>
        </div>
      )}
    </Wrapper>
  );
}

function Wrapper({ carga, children }: { carga?: Carga; children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6">
          <Link
            href="/cargas"
            className="mb-2 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Cargas
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {carga?.nombreArchivo ?? "Cargando…"}
          </h1>
          {carga?.proveedor && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Proveedor: {carga.proveedor.nombre}
            </p>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}
