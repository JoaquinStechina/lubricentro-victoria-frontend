"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, Loader2Icon, Maximize2Icon, Minimize2Icon, QrCodeIcon } from "lucide-react";
import { CAJA, ROJO } from "@/app/components/facturacion/estilos";
import {
  ErrorApi,
  etiquetaTipo,
  formatearNroComprobante,
  obtenerEnlacePublico,
  type EnlacePublico,
} from "@/app/lib/facturacion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Lo mínimo del comprobante para mostrar su QR: el id y cómo se llama. */
export type ComprobanteQr = { id: number; tipo: number; ptoVta: number; nro: number | null };

// QR para el cliente: se gira la pantalla del mostrador hacia el cliente, que
// lo escanea con la cámara del celular y ve su factura (el PDF) sin entrar al
// sistema. El enlace lo crea el backend la primera vez y después es siempre el
// mismo (GET /api/facturacion/comprobantes/:id/enlace-publico). Solo para
// comprobantes autorizados: quien lo usa ya lo filtra.
export default function QrClienteDialog({
  comprobante,
  compacto = false,
}: {
  comprobante: ComprobanteQr;
  /** Botón chico (en una fila del listado). */
  compacto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const nombre = `${etiquetaTipo(comprobante.tipo)} ${formatearNroComprobante(comprobante.ptoVta, comprobante.nro)}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          compacto ? (
            <Button
              variant="outline"
              size="sm"
              aria-label={`Mostrar QR para el cliente: ${nombre}`}
              title="Mostrar QR para el cliente"
            />
          ) : (
            <Button />
          )
        }
      >
        <QrCodeIcon />
        {compacto ? "QR" : "Mostrar QR para el cliente"}
      </DialogTrigger>
      {/* Ancho: el QR tiene que verse grande desde el otro lado del mostrador. */}
      <DialogContent className="sm:max-w-xl">
        {open && <ContenidoQr comprobante={comprobante} nombre={nombre} onCerrar={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

type Carga = { intento: number; enlace: EnlacePublico | null; error: ErrorApi | null };

function ContenidoQr({
  comprobante,
  nombre,
  onCerrar,
}: {
  comprobante: ComprobanteQr;
  nombre: string;
  onCerrar: () => void;
}) {
  const [intento, setIntento] = useState(0);
  const [carga, setCarga] = useState<Carga | null>(null);
  const [copia, setCopia] = useState<"ok" | "error" | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const campoUrl = useRef<HTMLInputElement>(null);
  // Este componente se monta recién al abrir el diálogo: acá ya hay `document`.
  const admitePantallaCompleta = typeof document !== "undefined" && document.fullscreenEnabled;

  useEffect(() => {
    let activo = true;
    obtenerEnlacePublico(comprobante.id).then(
      (enlace) => {
        if (activo) setCarga({ intento, enlace, error: null });
      },
      (err: unknown) => {
        if (activo) {
          setCarga({
            intento,
            enlace: null,
            error: err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo preparar el QR."),
          });
        }
      },
    );
    return () => {
      activo = false;
    };
  }, [comprobante.id, intento]);

  // Sigue al navegador: se sale de la pantalla completa también con Esc. Al
  // cerrar el diálogo el panel se desmonta y el navegador la deja solo.
  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(document.fullscreenElement !== null && document.fullscreenElement === panel.current);
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  const actual = carga !== null && carga.intento === intento ? carga : null;
  const enlace = actual?.enlace ?? null;

  function alternarPantallaCompleta() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void panel.current?.requestFullscreen().catch(() => undefined);
  }

  // navigator.clipboard solo existe con HTTPS (o en localhost). Mientras el
  // sistema se use por http://IP, se copia seleccionando el campo del enlace.
  async function copiar() {
    if (!enlace) return;
    try {
      if (window.isSecureContext && navigator.clipboard) {
        await navigator.clipboard.writeText(enlace.url);
        setCopia("ok");
        return;
      }
    } catch {
      // Se prueba con la selección.
    }
    const campo = campoUrl.current;
    if (!campo) return;
    campo.focus();
    campo.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    setCopia(ok ? "ok" : "error");
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>QR para el cliente</DialogTitle>
        <DialogDescription>
          Girá la pantalla hacia el cliente. Lo escanea con la cámara del celular y ve su comprobante en PDF; desde ahí
          lo puede descargar o compartir.
        </DialogDescription>
      </DialogHeader>

      {actual === null && (
        <p role="status" className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Loader2Icon className="size-4 animate-spin" />
          Preparando el QR…
        </p>
      )}

      {actual?.error && (
        <div role="alert" className={`${CAJA} ${ROJO}`}>
          <p>{actual.error.error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      )}

      {enlace && (
        <>
          {/* Siempre negro sobre blanco, también en modo oscuro: es lo que mejor lee una cámara. */}
          <div
            ref={panel}
            className={cn(
              "flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-center text-black dark:border-zinc-700",
              pantallaCompleta && "justify-center gap-6 rounded-none border-0 p-8",
            )}
          >
            <p className={cn("font-semibold", pantallaCompleta ? "text-5xl" : "text-2xl")}>Escaneá para ver tu factura</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG en línea de una data URI: next/image no aporta nada acá */}
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enlace.qrSvg)}`}
              alt={`Código QR con el enlace a ${nombre}`}
              className={cn(
                "aspect-square",
                pantallaCompleta ? "w-[min(70vh,90vw)]" : "w-full max-w-[min(60vh,26rem)]",
              )}
            />
            <p className={cn("font-medium tabular-nums", pantallaCompleta ? "text-4xl" : "text-lg")}>{nombre}</p>
            {pantallaCompleta && (
              <Button
                variant="outline"
                size="lg"
                className="border-zinc-300 bg-white text-black hover:bg-zinc-100 hover:text-black"
                onClick={alternarPantallaCompleta}
              >
                <Minimize2Icon />
                Salir de pantalla completa
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`enlace-cliente-${comprobante.id}`} className="text-xs text-zinc-600 dark:text-zinc-400">
              Enlace al comprobante (cualquiera que lo tenga puede ver esta factura)
            </label>
            <div className="flex gap-2">
              <Input
                id={`enlace-cliente-${comprobante.id}`}
                ref={campoUrl}
                readOnly
                value={enlace.url}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs md:text-xs"
              />
              <Button variant="outline" onClick={() => void copiar()}>
                {copia === "ok" ? <CheckIcon /> : <CopyIcon />}
                Copiar enlace
              </Button>
            </div>
            {copia === "ok" && (
              <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">
                Enlace copiado.
              </p>
            )}
            {copia === "error" && (
              <p role="alert" className="text-xs text-red-700 dark:text-red-400">
                No se pudo copiar solo: el enlace quedó seleccionado, copialo con Ctrl + C.
              </p>
            )}
          </div>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCerrar}>
          Cerrar
        </Button>
        {enlace && admitePantallaCompleta && (
          <Button onClick={alternarPantallaCompleta}>
            <Maximize2Icon />
            Pantalla completa
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
