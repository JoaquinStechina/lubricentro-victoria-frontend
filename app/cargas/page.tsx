"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import { ESTADO_LABELS, type Carga, type CargaEstado } from "@/app/lib/cargas";
import UploadForm from "@/app/components/cargas/UploadForm";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BADGE_VARIANT: Record<CargaEstado, "secondary" | "default" | "outline" | "destructive"> = {
  pendiente: "secondary",
  procesando: "secondary",
  revision_pendiente: "default",
  confirmacion_pendiente: "default",
  completado: "outline",
  error: "destructive",
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default function CargasPage() {
  const [cargas, setCargas] = useState<Carga[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch<Carga[]>("/api/uploads");
        if (active) setCargas(data);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeftIcon className="size-3.5" />
            Catálogo
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Cargar archivo de proveedor
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Subí una lista de precios (imagen, PDF o excel). Después de procesarla vas a poder
            revisar y corregir los datos antes de que se guarden.
          </p>
        </header>

        <UploadForm
          onUploaded={(carga) => {
            window.location.href = `/cargas/${carga.id}`;
          }}
        />

        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <TableHead>Archivo</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && cargas?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Todavía no se subió ningún archivo.
                  </TableCell>
                </TableRow>
              )}
              {cargas?.map((carga) => (
                <TableRow key={carga.id}>
                  <TableCell className="max-w-64 truncate text-zinc-900 dark:text-zinc-100">
                    {carga.nombreArchivo}
                  </TableCell>
                  <TableCell className="text-zinc-700 dark:text-zinc-300">
                    {carga.proveedor?.nombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-zinc-700 dark:text-zinc-300 uppercase">
                    {carga.tipoArchivo}
                  </TableCell>
                  <TableCell>
                    <Badge variant={BADGE_VARIANT[carga.estado]}>{ESTADO_LABELS[carga.estado]}</Badge>
                  </TableCell>
                  <TableCell className="text-zinc-700 dark:text-zinc-300">
                    {dateFormatter.format(new Date(carga.createdAt))}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/cargas/${carga.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {carga.estado === "completado" ? "Ver" : "Revisar"}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
