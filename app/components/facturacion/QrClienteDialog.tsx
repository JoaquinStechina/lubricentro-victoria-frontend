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
//
// «Pantalla completa»: el diálogo pasa a cubrir toda la ventana con el QR
// solo, y además se pide la pantalla completa del navegador (Fullscreen API).
// Si el navegador no la da, el QR igual ocupa toda la ventana. Esc o «Salir de
// pantalla completa» vuelven al diálogo normal.
export default function QrClienteDialog({
  comprobante,
  compacto = false,
}: {
  comprobante: ComprobanteQr;
  /** Botón chico (en una fila del listado). */
  compacto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [grande, setGrande] = useState(false);
  // Si este diálogo puso al navegador en pantalla completa (para no sacar una
  // que puso otro, y para volver al diálogo normal cuando se sale con Esc).
  const pusoPantallaCompleta = useRef(false);
  const nombre = `${etiquetaTipo(comprobante.tipo)} ${formatearNroComprobante(comprobante.ptoVta, comprobante.nro)}`;

  useEffect(() => {
    const alCambiar = () => {
      if (document.fullscreenElement === null && pusoPantallaCompleta.current) {
        pusoPantallaCompleta.current = false;
        setGrande(false);
      }
    };
    document.addEventListener("fullscreenchange", alCambiar);
    const puso = pusoPantallaCompleta;
    return () => {
      document.removeEventListener("fullscreenchange", alCambiar);
      // Si se navega a otra pantalla con el QR agrandado, no queda la página en pantalla completa.
      if (puso.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  function salirDePantallaCompleta() {
    setGrande(false);
    if (pusoPantallaCompleta.current && document.fullscreenElement) {
      pusoPantallaCompleta.current = false;
      void document.exitFullscreen().catch(() => undefined);
    }
  }

  function agrandar() {
    setGrande(true);
    const pagina = document.documentElement;
    if (document.fullscreenEnabled && !document.fullscreenElement && pagina.requestFullscreen) {
      pagina.requestFullscreen().then(
        () => {
          pusoPantallaCompleta.current = true;
        },
        () => undefined,
      );
    }
  }

  function cambiarAbierto(siguiente: boolean) {
    // Esc con el QR agrandado vuelve al diálogo normal, no lo cierra.
    if (!siguiente && grande) {
      salirDePantallaCompleta();
      return;
    }
    setOpen(siguiente);
  }

  return (
    <Dialog open={open} onOpenChange={cambiarAbierto}>
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
      {/* Normal: ancho, para que el QR se vea grande desde el otro lado del
          mostrador, y con alto acotado y scroll, para que «Pantalla completa»
          y «Cerrar» no queden fuera de una ventana baja. Agrandado: cubre
          toda la ventana, blanco. */}
      <DialogContent
        showCloseButton={!grande}
        className={
          grande
            ? "top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-white p-0 text-black ring-0 sm:max-w-none"
            : "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        }
      >
        {open && (
          <ContenidoQr
            comprobante={comprobante}
            nombre={nombre}
            grande={grande}
            onAgrandar={agrandar}
            onAchicar={salirDePantallaCompleta}
            onCerrar={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Carga = { intento: number; enlace: EnlacePublico | null; error: ErrorApi | null };

function ContenidoQr({
  comprobante,
  nombre,
  grande,
  onAgrandar,
  onAchicar,
  onCerrar,
}: {
  comprobante: ComprobanteQr;
  nombre: string;
  grande: boolean;
  onAgrandar: () => void;
  onAchicar: () => void;
  onCerrar: () => void;
}) {
  const [intento, setIntento] = useState(0);
  const [carga, setCarga] = useState<Carga | null>(null);
  const [copia, setCopia] = useState<"ok" | "error" | null>(null);
  const campoUrl = useRef<HTMLInputElement>(null);

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

  const actual = carga !== null && carga.intento === intento ? carga : null;
  const enlace = actual?.enlace ?? null;

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
      <DialogHeader className={cn(grande && "sr-only")}>
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
        // Siempre negro sobre blanco, también en modo oscuro: es lo que mejor lee una cámara.
        <div
          className={cn(
            "flex flex-col items-center bg-white text-center text-black",
            grande ? "h-full justify-center gap-6 p-6" : "gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700",
          )}
        >
          <p className={cn("font-semibold", grande ? "text-4xl sm:text-5xl" : "text-2xl")}>Escaneá para ver tu factura</p>
          {/* Agrandado: el alto que dejan los textos y el botón (16rem), así todo entra sin scroll. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG en una data URI: next/image no aporta nada acá */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enlace.qrSvg)}`}
            alt={`Código QR con el enlace a ${nombre}`}
            className={cn("aspect-square", grande ? "w-[min(calc(100dvh-16rem),90vw)]" : "w-full max-w-[min(45dvh,26rem)]")}
          />
          <p className={cn("font-medium tabular-nums", grande ? "text-3xl sm:text-4xl" : "text-lg")}>{nombre}</p>
          {grande && (
            <Button
              variant="outline"
              size="lg"
              className="border-zinc-300 bg-white text-black hover:bg-zinc-100 hover:text-black dark:border-zinc-300 dark:bg-white dark:hover:bg-zinc-100"
              onClick={onAchicar}
            >
              <Minimize2Icon />
              Salir de pantalla completa
            </Button>
          )}
        </div>
      )}

      {enlace && !grande && (
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
      )}

      {!grande && (
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
          {enlace && (
            <Button onClick={onAgrandar}>
              <Maximize2Icon />
              Pantalla completa
            </Button>
          )}
        </DialogFooter>
      )}
    </>
  );
}
