"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import type { Oferta } from "@/app/lib/ofertas";
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
  numeroOferta: number;
  descuentoPct: number;
  precioUnitario: number;
  moneda: string;
  fechaOferta: string;
  fechaHasta: string | null;
  activa: boolean;
  eliminado: boolean;
  archivoOrigen: string;
  createdAt: string;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR");
}

// Historial de un tramo de oferta (mismo proveedor+SKU+desde cantidad a
// través de las cargas): gráfico del precio unitario + tabla completa.
export default function HistorialOfertaDialog({
  oferta,
  open,
  onOpenChange,
}: {
  oferta: Oferta;
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
    apiFetch<{ items: HistorialItem[] }>(`/api/ofertas/${oferta.id}/historial`)
      .then((res) => {
        if (active) setItems(res.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [open, oferta.id]);

  const puntos = (items ?? []).map((item) => ({
    etiqueta: formatFecha(item.createdAt),
    valor: item.precioUnitario,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial del tramo</DialogTitle>
          <DialogDescription>
            {oferta.proveedor?.nombre ?? "—"} · {oferta.skuProveedor} · desde{" "}
            {oferta.desdeCantidad} unidad{oferta.desdeCantidad === 1 ? "" : "es"}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {!items && !error && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando…</p>
        )}
        {items && (
          <>
            <HistorialChart
              puntos={puntos}
              formatValor={(v) => currencyFormatter.format(v)}
            />
            <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <TableHead>Fecha de carga</TableHead>
                    <TableHead className="text-right">N° oferta</TableHead>
                    <TableHead className="text-right">Descuento %</TableHead>
                    <TableHead className="text-right">Precio unitario</TableHead>
                    <TableHead>Válida hasta</TableHead>
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
                      <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                        {item.numeroOferta}
                      </TableCell>
                      <TableCell className="text-right text-zinc-700 dark:text-zinc-300">
                        {item.descuentoPct}%
                      </TableCell>
                      <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                        {currencyFormatter.format(item.precioUnitario)}
                      </TableCell>
                      <TableCell className="text-zinc-700 dark:text-zinc-300">
                        {item.fechaHasta ?? "Hasta agotar stock"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {item.archivoOrigen}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <Badge variant={item.activa ? "secondary" : "outline"}>
                            {item.activa ? "Activa" : "Cerrada"}
                          </Badge>
                          {item.eliminado && <Badge variant="destructive">Eliminada</Badge>}
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
