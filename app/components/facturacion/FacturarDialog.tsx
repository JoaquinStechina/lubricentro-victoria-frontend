"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { AMBAR, CAJA, ROJO } from "@/app/components/facturacion/estilos";
import {
  ErrorApi,
  formatearMoneda,
  MOTIVO_OMITIDO,
  obtenerVistaPreviaStock,
  type OmitidoStock,
  type VistaPreviaStock,
} from "@/app/lib/facturacion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Carga = { ventaId: number; intento: number; vista: VistaPreviaStock | null; error: string | null };

// Confirmación de "facturar": pregunta si se descuentan del stock los ítems
// vinculados a artículos. Emitir no se deshace, por eso siempre se confirma.
// Al abrirse pide la vista previa (GET /api/ventas/:id/stock).
export default function FacturarDialog({
  ventaId,
  open,
  onOpenChange,
  onConfirmar,
  ocupado,
  cliente,
  total,
}: {
  ventaId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (descontarStock: boolean) => void;
  ocupado: boolean;
  /** A quién se emite: nombre del cliente (sin cliente: Consumidor Final). */
  cliente?: string | null;
  /** Importe total del comprobante, si se conoce. */
  total?: number | null;
}) {
  const [carga, setCarga] = useState<Carga | null>(null);
  // Cambia para repetir la consulta ("Reintentar").
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!open || ventaId === null) return;
    let active = true;
    obtenerVistaPreviaStock(ventaId)
      .then((vista) => {
        if (active) setCarga({ ventaId, intento, vista, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setCarga({
            ventaId,
            intento,
            vista: null,
            error: err instanceof ErrorApi ? err.message : "No se pudo calcular el stock.",
          });
        }
      });
    return () => {
      active = false;
      // Al cerrar se descarta lo cargado: el stock puede cambiar antes de volver a abrir.
      setCarga(null);
    };
  }, [open, ventaId, intento]);

  // Una respuesta de otra venta o de un intento anterior no cuenta: se espera.
  const actual = carga !== null && carga.ventaId === ventaId && carga.intento === intento ? carga : null;
  const vista = actual?.vista ?? null;
  const hayDescontables = vista !== null && vista.descontables.length > 0;

  // Facturar no se deshace: en todos los estados se dice a quién y por cuánto.
  const destino = `Se emite el comprobante a ${cliente ?? "Consumidor Final"}${
    total != null ? ` por ${formatearMoneda(total)}` : ""
  }.`;

  function confirmar(descontar: boolean) {
    onOpenChange(false);
    onConfirmar(descontar);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hayDescontables ? "¿Descontar del stock?" : `¿Facturar la venta #${ventaId}?`}</DialogTitle>
          <DialogDescription>
            {hayDescontables
              ? `${destino} Elegí si los artículos de la venta salen del stock.`
              : `${destino} Una factura autorizada no se puede editar ni borrar: para corregirla hay que emitir una nota de crédito.`}
          </DialogDescription>
        </DialogHeader>

        {actual === null && (
          <p role="status" className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Loader2Icon className="size-4 animate-spin" />
            Calculando el stock…
          </p>
        )}

        {actual?.error && (
          <p role="alert" className={`${CAJA} ${ROJO}`}>
            {actual.error}
          </p>
        )}

        {vista && hayDescontables && (
          <ul className="flex flex-col gap-1 text-sm">
            {vista.descontables.map((d) => (
              <li key={d.articuloId} className="flex flex-col">
                <span>
                  {d.cantidad} × {d.marca} {d.codigo} – {d.descripcion}
                </span>
                <span
                  className={
                    d.quedaria < 0
                      ? "flex items-center gap-1 text-red-700 dark:text-red-300"
                      : "text-zinc-600 dark:text-zinc-400"
                  }
                >
                  {d.quedaria < 0 && <AlertTriangleIcon className="size-3.5" aria-label="Stock negativo" />}
                  hay {d.stockActual} → quedan {d.quedaria}
                </span>
              </li>
            ))}
          </ul>
        )}

        {vista && vista.omitidos.length > 0 && <Omitidos omitidos={vista.omitidos} />}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ocupado}>
            Cancelar
          </Button>
          {actual?.error && (
            <>
              <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </Button>
              <Button onClick={() => confirmar(false)} disabled={ocupado}>
                Facturar sin descontar
              </Button>
            </>
          )}
          {vista && hayDescontables && (
            <>
              <Button variant="outline" onClick={() => confirmar(false)} disabled={ocupado}>
                Facturar sin descontar
              </Button>
              <Button onClick={() => confirmar(true)} disabled={ocupado}>
                Facturar y descontar
              </Button>
            </>
          )}
          {vista && !hayDescontables && (
            <Button onClick={() => confirmar(false)} disabled={ocupado}>
              Facturar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Omitidos({ omitidos }: { omitidos: OmitidoStock[] }) {
  return (
    <div className={`${CAJA} ${AMBAR}`}>
      <p className="font-medium">No se descuentan del stock:</p>
      <ul className="mt-1 list-disc pl-5">
        {omitidos.map((o, i) => (
          <li key={i}>
            {o.descripcion} ({MOTIVO_OMITIDO[o.motivo]})
          </li>
        ))}
      </ul>
    </div>
  );
}
