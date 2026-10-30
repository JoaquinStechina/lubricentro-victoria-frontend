"use client";

import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { formatearNroComprobante, etiquetaTipo, textoObservaciones } from "@/app/lib/facturacion";
import type { ResultadoEmision } from "@/app/lib/useEmitirFactura";
import { Button } from "@/components/ui/button";

const CAJA = "rounded-lg border px-4 py-3 text-sm";
const ROJO = "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
const AMBAR = "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100";
const VERDE =
  "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";

// Muestra el resultado de intentar facturar una venta. Ninguno de los estados
// que no son "autorizado" se presenta como éxito, y todos dicen que la venta
// quedó guardada (nunca se pierde por un problema al facturar).
export default function ResultadoEmisionPanel({
  resultado,
  onReintentar,
  reintentando,
  onCerrar,
}: {
  resultado: ResultadoEmision;
  onReintentar: () => void;
  reintentando: boolean;
  onCerrar?: () => void;
}) {
  const cerrar = onCerrar && (
    <Button variant="ghost" size="sm" onClick={onCerrar}>
      Cerrar aviso
    </Button>
  );

  if (resultado.tipo === "autorizado") {
    const c = resultado.comprobante;
    return (
      <div role="status" className={`${CAJA} ${VERDE}`}>
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2Icon className="size-4 shrink-0" />
          {etiquetaTipo(c.tipo)} {formatearNroComprobante(c.ptoVta, c.nro)} autorizada. Abriendo el comprobante…
        </p>
        <Link href={`/facturacion/${c.id}`} className="mt-1 inline-block underline">
          Ir al comprobante
        </Link>
      </div>
    );
  }

  if (resultado.tipo === "pendiente") {
    const c = resultado.comprobante;
    return (
      <div role="alert" className={`${CAJA} ${AMBAR} border-2`}>
        <p className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangleIcon className="size-5 shrink-0" />
          La factura quedó pendiente de confirmar con ARCA
        </p>
        {c.motivoError && <p className="mt-2">{c.motivoError}</p>}
        <p className="mt-2">
          Todavía no sabemos si ARCA la autorizó, así que <strong>no la vuelvas a emitir</strong>. Abrí el comprobante y
          usá «Reconciliar»: se le consulta a ARCA si el número existe y se resuelve solo. Mientras esté pendiente, la
          numeración de ese tipo de comprobante puede quedar bloqueada unos minutos.
        </p>
        <p className="mt-2">La venta #{resultado.ventaId} está guardada.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href={`/facturacion/${c.id}`} />}>Abrir comprobante y reconciliar</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/ventas" />}>
            Ver ventas
          </Button>
          {cerrar}
        </div>
      </div>
    );
  }

  if (resultado.tipo === "fallido") {
    const c = resultado.comprobante;
    const observaciones = textoObservaciones(c.observaciones);
    return (
      <div role="alert" className={`${CAJA} ${ROJO}`}>
        <p className="flex items-center gap-2 text-base font-semibold">
          <XCircleIcon className="size-5 shrink-0" />
          {c.estado === "rechazado" ? "ARCA rechazó la factura" : "No se pudo emitir la factura"}
        </p>
        {c.motivoError && <p className="mt-2">{c.motivoError}</p>}
        {observaciones.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {observaciones.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        )}
        <p className="mt-2">
          La venta #{resultado.ventaId} quedó guardada, <strong>sin facturar</strong>. Podés corregir el problema y
          volver a intentar: se crea un intento nuevo (el anterior queda registrado como no autorizado).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={onReintentar} disabled={reintentando}>
            {reintentando ? "Facturando…" : "Reintentar facturación"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={`/facturacion/${c.id}`} />}>
            Ver el intento
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/ventas" />}>
            Ver ventas
          </Button>
          {cerrar}
        </div>
      </div>
    );
  }

  const { error } = resultado;
  // Sin respuesta del servidor (red caída, timeout) o error de servidor: no se
  // sabe si la factura se emitió. Reintentar es seguro porque reusa la misma
  // clave de idempotencia: si ya se emitió, devuelve ese comprobante.
  const incierto = error.status === 0 || error.status >= 500;
  return (
    <div role="alert" className={`${CAJA} ${ROJO}`}>
      <p className="flex items-center gap-2 text-base font-semibold">
        <XCircleIcon className="size-5 shrink-0" />
        {incierto ? "No pudimos confirmar si la factura se emitió" : "No se pudo facturar la venta"}
      </p>
      <p className="mt-2">{error.error}</p>
      {error.detalles.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {error.detalles.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      <p className="mt-2">
        La venta #{resultado.ventaId} quedó guardada.{" "}
        {incierto
          ? "Reintentar es seguro: se repite la misma operación y, si la factura ya se había emitido, no se duplica."
          : "Corregí el problema y reintentá."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onReintentar} disabled={reintentando}>
          {reintentando ? "Facturando…" : "Reintentar facturación"}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/ventas" />}>
          Ver ventas
        </Button>
        {cerrar}
      </div>
    </div>
  );
}
