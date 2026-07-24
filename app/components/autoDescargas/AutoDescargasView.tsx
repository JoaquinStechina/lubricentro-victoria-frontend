"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlayIcon, TrashIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import type { AutoDescargaMarca } from "@/app/lib/autoDescargas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import NuevaAutoDescargaDialog from "@/app/components/autoDescargas/NuevaAutoDescargaDialog";
import EditarAutoDescargaDialog from "@/app/components/autoDescargas/EditarAutoDescargaDialog";
import EliminarAutoDescargaDialog from "@/app/components/autoDescargas/EliminarAutoDescargaDialog";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

function resultadoVariant(resultado: string | null): "secondary" | "default" | "destructive" {
  if (!resultado) return "secondary";
  if (resultado.startsWith("error")) return "destructive";
  if (resultado === "carga_creada") return "default";
  return "secondary";
}

export default function AutoDescargasView() {
  const [filas, setFilas] = useState<AutoDescargaMarca[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probandoIds, setProbandoIds] = useState<Set<number>>(new Set());
  const [eliminarId, setEliminarId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<AutoDescargaMarca[]>("/api/auto-descargas")
      .then((data) => {
        if (active) setFilas(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo cargar la lista");
      });
    return () => {
      active = false;
    };
  }, []);

  function upsert(fila: AutoDescargaMarca) {
    setFilas((prev) => {
      if (!prev) return [fila];
      const existe = prev.some((f) => f.id === fila.id);
      return existe ? prev.map((f) => (f.id === fila.id ? fila : f)) : [...prev, fila];
    });
  }

  async function toggleActivo(fila: AutoDescargaMarca) {
    try {
      const actualizada = await apiFetch<AutoDescargaMarca>(
        `/api/auto-descargas/${fila.id}`,
        apiJsonInit({ activo: !fila.activo }, "PATCH")
      );
      upsert(actualizada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la fila");
    }
  }

  async function probarAhora(fila: AutoDescargaMarca) {
    setProbandoIds((prev) => new Set(prev).add(fila.id));
    setError(null);
    try {
      const actualizada = await apiFetch<AutoDescargaMarca>(`/api/auto-descargas/${fila.id}/probar`, {
        method: "POST",
      });
      upsert(actualizada);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo probar la descarga");
    } finally {
      setProbandoIds((prev) => {
        const next = new Set(prev);
        next.delete(fila.id);
        return next;
      });
    }
  }

  const eliminando = filas?.find((f) => f.id === eliminarId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <NuevaAutoDescargaDialog onCreated={upsert} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!filas ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando...</p>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>% Ganancia</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Última corrida</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Todavía no hay marcas configuradas.
                  </TableCell>
                </TableRow>
              )}
              {filas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell>{fila.proveedor.nombre}</TableCell>
                  <TableCell>{fila.marca}</TableCell>
                  <TableCell>
                    {fila.porcentajeGanancia != null ? `${fila.porcentajeGanancia}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch checked={fila.activo} onCheckedChange={() => toggleActivo(fila)} />
                  </TableCell>
                  <TableCell className="text-zinc-500 dark:text-zinc-500">
                    {fila.ultimaCorridaEn ? dateFormatter.format(new Date(fila.ultimaCorridaEn)) : "—"}
                  </TableCell>
                  <TableCell>
                    {fila.ultimoResultado ? (
                      <Badge variant={resultadoVariant(fila.ultimoResultado)}>
                        {fila.ultimoResultado === "carga_creada" && fila.ultimaCargaId ? (
                          <Link href={`/cargas/${fila.ultimaCargaId}`} className="hover:underline">
                            carga_creada
                          </Link>
                        ) : (
                          fila.ultimoResultado
                        )}
                      </Badge>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={probandoIds.has(fila.id)}
                        onClick={() => probarAhora(fila)}
                      >
                        <PlayIcon className="size-3.5" />
                        {probandoIds.has(fila.id) ? "Probando..." : "Probar ahora"}
                      </Button>
                      <EditarAutoDescargaDialog
                        fila={fila}
                        onUpdated={upsert}
                        disabled={probandoIds.has(fila.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={probandoIds.has(fila.id)}
                        onClick={() => setEliminarId(fila.id)}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {eliminando && (
        <EliminarAutoDescargaDialog
          fila={eliminando}
          open={eliminarId !== null}
          onOpenChange={(open) => !open && setEliminarId(null)}
          onDeleted={(id) => {
            setFilas((prev) => (prev ? prev.filter((f) => f.id !== id) : prev));
            setEliminarId(null);
          }}
        />
      )}
    </div>
  );
}
