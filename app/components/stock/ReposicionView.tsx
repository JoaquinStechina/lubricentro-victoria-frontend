"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import type { FilaReposicion } from "@/app/lib/stock";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

// Artículos en o bajo su mínimo. Sin paginación ni filtros: por definición la
// lista es corta, y ya viene ordenada por urgencia (mayor faltante primero)
// desde el backend.
export default function ReposicionView() {
  const [items, setItems] = useState<FilaReposicion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ items: FilaReposicion[] }>("/api/stock/reposicion")
      .then((json) => {
        if (active) setItems(json.items);
      })
      .catch((e) => {
        if (!active) return;
        setItems([]);
        setError(e instanceof Error ? e.message : "No se pudo cargar la reposición.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      {/* Sin esta nota la columna "Comprar a" se malinterpreta: el precio no
          es un dato del artículo de stock, sale del catálogo de proveedores. */}
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        El precio sale del catálogo de proveedores vigente, matcheando por código (ignorando
        mayúsculas, espacios, guiones y puntos). &quot;Sin referencia&quot; significa que ese
        artículo no aparece en ninguna lista de proveedor cargada.
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <TableHead>Artículo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Faltan</TableHead>
              <TableHead>Comprar a</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items === null ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  Nada para reponer: ningún artículo está en o bajo su mínimo.
                </TableCell>
              </TableRow>
            ) : (
              items.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell className="whitespace-normal">
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {fila.marca} <span className="font-mono text-xs">{fila.codigo}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">{fila.descripcion}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        fila.cantidad < 0
                          ? "font-medium text-destructive"
                          : "text-zinc-900 dark:text-zinc-100"
                      }
                    >
                      {fila.cantidad}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                    {fila.minimo}
                  </TableCell>
                  <TableCell className="text-right font-medium text-zinc-900 dark:text-zinc-100">
                    {fila.faltante}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {fila.mejorOpcion ? (
                      <span className="text-zinc-900 dark:text-zinc-100">
                        {fila.mejorOpcion.proveedor} —{" "}
                        {currencyFormatter.format(fila.mejorOpcion.precio)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sin referencia en catálogo</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
