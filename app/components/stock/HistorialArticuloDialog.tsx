"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import { TIPO_MOVIMIENTO_LABELS, type ArticuloStock, type MovimientoStock } from "@/app/lib/stock";
import { cn } from "@/lib/utils";
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

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-AR");
}

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

// Contenido montado con key={articuloId} desde el padre: al desmontar (el
// padre deja de renderizarlo cuando `articulo` vuelve a null al cerrar) y
// volver a montar en la próxima apertura, el useState(null) inicial YA es
// el reset — no hace falta (ni conviene, ver react-hooks/set-state-in-effect)
// pisar `items`/`error` sincrónicamente dentro del efecto.
function HistorialContenido({ articuloId }: { articuloId: number }) {
  const [items, setItems] = useState<MovimientoStock[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ items: MovimientoStock[] }>(`/api/stock/${articuloId}/movimientos`)
      .then((res) => {
        if (active) setItems(res.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [articuloId]);

  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!items && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando…</p>}
      {items && items.length === 0 && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin movimientos registrados</p>
      )}
      {items && items.length > 0 && (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Resultante</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-zinc-700 dark:text-zinc-300">{formatFecha(item.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TIPO_MOVIMIENTO_LABELS[item.tipo]}</Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      item.delta > 0 && "text-emerald-600 dark:text-emerald-400",
                      item.delta < 0 && "text-destructive",
                      item.delta === 0 && "text-muted-foreground"
                    )}
                  >
                    {formatDelta(item.delta)}
                  </TableCell>
                  <TableCell className="text-right text-zinc-900 dark:text-zinc-100">
                    {item.cantidadResultante}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {item.motivo ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

// Historial de movimientos (entradas/salidas/ajustes) de un artículo de
// stock — ver GET /api/stock/:id/movimientos, orden más reciente primero.
// No hay prop `open` separada: el padre modela la selección con
// `articulo: ArticuloStock | null` y acá el diálogo está abierto cuando no
// es null, igual que HistorialProductoDialog hace con su propio `open`.
export default function HistorialArticuloDialog({
  articulo,
  onOpenChange,
}: {
  articulo: ArticuloStock | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={articulo !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de movimientos</DialogTitle>
          <DialogDescription>{articulo ? `${articulo.marca} · ${articulo.codigo}` : "—"}</DialogDescription>
        </DialogHeader>

        {articulo && <HistorialContenido key={articulo.id} articuloId={articulo.id} />}
      </DialogContent>
    </Dialog>
  );
}
