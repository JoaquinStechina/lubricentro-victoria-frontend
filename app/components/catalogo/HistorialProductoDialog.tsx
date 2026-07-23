"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import type { Producto } from "@/app/lib/productos";
import HistorialChart from "@/app/components/HistorialChart";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type HistorialItem = {
  id: number;
  precioNeto: number | null;
  precioConIva: number | null;
  alicuotaIva: number | null;
  fechaVigencia: string | null;
  vigente: boolean;
  eliminado: boolean;
  createdAt: string;
  carga: { nombreArchivo: string } | null;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatPrecio(valor: number | null) {
  return valor === null || valor === undefined ? "—" : currencyFormatter.format(valor);
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR");
}

// Historial de precios de un SKU del catálogo: gráfico (serie precio neto,
// con fallback a precio c/IVA donde el neto es null) + tabla completa.
export default function HistorialProductoDialog({
  producto,
  open,
  onOpenChange,
}: {
  producto: Producto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<HistorialItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setItems(null);
    setError(null);
    apiFetch<{ items: HistorialItem[] }>(`/api/productos/${producto.id}/historial`)
      .then((res) => {
        if (active) setItems(res.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [open, producto.id]);

  const puntos = (items ?? [])
    .map((item) => ({
      etiqueta: formatFecha(item.createdAt),
      valor: item.precioNeto ?? item.precioConIva,
    }))
    .filter((p): p is { etiqueta: string; valor: number } => p.valor !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de precios</DialogTitle>
          <DialogDescription>
            {producto.proveedor?.nombre ?? "—"} · {producto.marca ?? "—"} ·{" "}
            {producto.skuInterno ?? producto.skuProveedor ?? "—"}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!items && !error && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando…</p>
        )}
        {items && (
          <>
            <HistorialChart puntos={puntos} formatValor={(v) => formatPrecio(v)} />
            <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <TableHead>Fecha de carga</TableHead>
                    <TableHead className="text-right">Precio neto</TableHead>
                    <TableHead className="text-right">Precio Neto C/IVA</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-zinc-700 dark:text-zinc-300">
                        {formatFecha(item.createdAt)}
                      </TableCell>
                      <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                        {formatPrecio(item.precioNeto)}
                      </TableCell>
                      <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                        {formatPrecio(item.precioConIva)}
                      </TableCell>
                      <TableCell className="text-zinc-700 dark:text-zinc-300">
                        {item.fechaVigencia ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {item.carga?.nombreArchivo ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {item.vigente && !item.eliminado && (
                            <Badge variant="secondary">Vigente</Badge>
                          )}
                          {item.eliminado && <Badge variant="destructive">Eliminado</Badge>}
                          {!item.vigente && !item.eliminado && (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
