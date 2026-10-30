"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, XCircleIcon } from "lucide-react";
import ItemsEditor from "@/app/components/facturacion/ItemsEditor";
import {
  ErrorApi,
  etiquetaEstado,
  etiquetaTipo,
  fetchFacturacion,
  formatearMoneda,
  formatearNroComprobante,
  jsonInit,
  textoObservaciones,
  varianteEstado,
  type ComprobanteConItems,
  type ComprobanteDetalle,
  type ItemEntrada,
} from "@/app/lib/facturacion";
import { itemVacio, itemsParaGuardar, nuevaClave, type ItemFormulario } from "@/app/lib/ventasForm";
import { Badge } from "@/components/ui/badge";
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

export type Naturaleza = "credito" | "debito";

// Resultado de un intento de emitir la nota. Igual que en la emisión de
// facturas, el status HTTP no alcanza: un 201 puede traer un comprobante
// rechazado o con error. Solo `error` es una falla de la petición.
type ResultadoNota =
  | { tipo: "autorizado"; comprobante: ComprobanteConItems }
  | { tipo: "pendiente"; comprobante: ComprobanteConItems }
  | { tipo: "fallido"; comprobante: ComprobanteConItems }
  | { tipo: "error"; error: ErrorApi };

function clasificar(status: number, comprobante: ComprobanteConItems): ResultadoNota {
  if (comprobante.estado === "autorizado") return { tipo: "autorizado", comprobante };
  if (status === 202 || comprobante.estado === "pendiente") return { tipo: "pendiente", comprobante };
  return { tipo: "fallido", comprobante };
}

const CAJA = "rounded-lg border px-4 py-3 text-sm";
const ROJO = "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
const AMBAR =
  "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100";

// Anulación (nota de crédito) o nota de débito sobre un comprobante
// autorizado. El botón que lo abre y el diálogo viven acá.
//
// Idempotencia: la clave identifica una INTENCIÓN de emitir esta nota. Se
// guarda en un ref junto con una huella del pedido (naturaleza + ítems) y se
// REUTILIZA mientras el backend no haya respondido con un comprobante (error
// de red, timeout, 5xx, doble clic, incluso cerrando y reabriendo el diálogo):
// si el servidor sí procesó el pedido, repetir la clave devuelve esa nota en
// vez de emitir otra. Si el usuario cambia lo que va a emitir, la huella
// cambia y se usa una clave nueva. En cuanto el backend devuelve un
// comprobante (de cualquier estado) la intención terminó y la clave se
// descarta. El ref vive en este componente (no en el formulario) para que
// sobreviva al cierre del diálogo.
export default function NotaDialog({
  original,
  naturaleza,
  onEmitida,
}: {
  original: ComprobanteDetalle;
  naturaleza: Naturaleza;
  /** Se llama con la nota creada (en cualquier estado) para que el padre refresque. */
  onEmitida?: (nota: ComprobanteConItems) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);
  const intento = useRef<{ huella: string; clave: string } | null>(null);
  // Si el usuario se va de la pantalla con la nota en curso, la respuesta
  // llega a un componente desmontado: no hay que arrastrarlo al comprobante.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // `items` undefined = anulación total (el campo se OMITE del pedido; un []
  // es un error de validación en el backend, no un "total").
  // Devuelve null si ya había un envío en curso (el segundo clic se ignora).
  async function enviar(items: ItemEntrada[] | undefined): Promise<ResultadoNota | null> {
    if (enVuelo.current) return null;
    enVuelo.current = true;
    setEnviando(true);

    const huella = JSON.stringify({ naturaleza, items: items ?? null });
    if (intento.current?.huella !== huella) intento.current = { huella, clave: nuevaClave() };
    const claveIdempotencia = intento.current.clave;
    const cuerpo = items ? { naturaleza, items, claveIdempotencia } : { naturaleza, claveIdempotencia };

    let final: ResultadoNota;
    try {
      const res = await fetchFacturacion<ComprobanteConItems>(
        `/api/facturacion/comprobantes/${original.id}/notas`,
        jsonInit(cuerpo, "POST"),
      );
      // El backend respondió con un comprobante: la intención terminó.
      intento.current = null;
      final = clasificar(res.status, res.data);
    } catch (err) {
      // Sin comprobante: la clave se conserva para el próximo intento.
      final = { tipo: "error", error: err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo emitir la nota.") };
    }

    if (final.tipo !== "error") onEmitida?.(final.comprobante);
    if (final.tipo === "autorizado") {
      // No se libera `enVuelo`: la pantalla se está yendo a la nota y otro
      // clic (con clave nueva) emitiría una segunda.
      setOpen(false);
      if (montado.current) router.push(`/facturacion/${final.comprobante.id}`);
      return final;
    }
    enVuelo.current = false;
    setEnviando(false);
    return final;
  }

  function cambiarAbierto(siguiente: boolean) {
    // Mientras el pedido está en curso no se puede cerrar: se perdería el
    // resultado de una operación que no se deshace.
    if (!siguiente && enVuelo.current) return;
    setOpen(siguiente);
  }

  const esCredito = naturaleza === "credito";

  return (
    <Dialog open={open} onOpenChange={cambiarAbierto}>
      <DialogTrigger render={<Button variant={esCredito ? "destructive" : "outline"} />}>
        {esCredito ? "Anular (nota de crédito)" : "Nota de débito"}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {/* El formulario vive DENTRO del contenido, que se desmonta al cerrar:
            cada apertura arranca limpia (modo, ítems y avisos) sin copiar
            props a estado desde un efecto. */}
        <NotaForm
          original={original}
          naturaleza={naturaleza}
          enviando={enviando}
          enviar={enviar}
          onCancelar={() => cambiarAbierto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function NotaForm({
  original,
  naturaleza,
  enviando,
  enviar,
  onCancelar,
}: {
  original: ComprobanteDetalle;
  naturaleza: Naturaleza;
  enviando: boolean;
  enviar: (items: ItemEntrada[] | undefined) => Promise<ResultadoNota | null>;
  onCancelar: () => void;
}) {
  const esCredito = naturaleza === "credito";
  const [modo, setModo] = useState<"total" | "parcial">("total");
  const [items, setItems] = useState<ItemFormulario[]>(() => [itemVacio()]);
  const [resultado, setResultado] = useState<ResultadoNota | null>(null);

  const total = esCredito && modo === "total";
  // Descarta productoPrecioId: las notas no lo usan (el backend también lo
  // ignora). undefined = todavía no hay ítems válidos (o es anulación total).
  const itemsNota: ItemEntrada[] | undefined = total
    ? undefined
    : itemsParaGuardar(items)?.map(({ descripcion, cantidad, precioUnitario, alicuotaIva }) => ({
        descripcion,
        cantidad,
        precioUnitario,
        alicuotaIva,
      }));
  const puedeEmitir = total || itemsNota !== undefined;

  async function emitir() {
    if (!puedeEmitir) return;
    setResultado(null);
    // Anulación total: `items` se omite (undefined), nunca se manda [].
    const r = await enviar(total ? undefined : itemsNota);
    // null: había otro envío en curso, el que corresponde mostrar es el suyo.
    if (r && r.tipo !== "autorizado") setResultado(r);
  }

  const notasPrevias = original.notas;
  const bloqueado = enviando;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{esCredito ? "Anular con una nota de crédito" : "Emitir una nota de débito"}</DialogTitle>
        <DialogDescription>
          Sobre {etiquetaTipo(original.tipo)} {formatearNroComprobante(original.ptoVta, original.nro)} por{" "}
          {formatearMoneda(original.impTotal)}. La nota queda asociada a este comprobante y, una vez autorizada, no se
          puede editar ni borrar.
        </DialogDescription>
      </DialogHeader>

      {notasPrevias.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">Notas ya emitidas sobre este comprobante</p>
          <ul className="flex flex-col gap-1">
            {notasPrevias.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <span>
                  {etiquetaTipo(n.tipo)} {formatearNroComprobante(n.ptoVta, n.nro)}
                </span>
                <Badge variant={varianteEstado(n.estado)}>{etiquetaEstado(n.estado)}</Badge>
                <span className="tabular-nums">{formatearMoneda(n.impTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {esCredito && (
        <fieldset className="flex flex-col gap-2 text-sm" disabled={bloqueado}>
          <legend className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">Qué se anula</legend>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="modo-nota"
              checked={modo === "total"}
              onChange={() => setModo("total")}
              className="mt-0.5"
            />
            <span>
              <strong>Anulación total</strong>: se acredita el importe del comprobante original (
              {formatearMoneda(original.impTotal)}) con los mismos ítems.
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="modo-nota"
              checked={modo === "parcial"}
              onChange={() => setModo("parcial")}
              className="mt-0.5"
            />
            <span>
              <strong>Nota parcial</strong>: se acreditan solo los ítems que cargues abajo.
            </span>
          </label>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Para refacturar a otro receptor, después de anular creá una venta nueva.
          </p>
        </fieldset>
      )}

      {!esCredito && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Cargá los ítems que se cobran de más (intereses, ajustes). Una nota de débito siempre lleva al menos un ítem.
        </p>
      )}

      {!total && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Los precios se interpretan {original.preciosIncluyenIva ? "con" : "sin"} IVA, igual que el comprobante
            original.
          </p>
          <ItemsEditor
            items={items}
            onChange={setItems}
            preciosIncluyenIva={original.preciosIncluyenIva}
            disabled={bloqueado}
          />
          {!puedeEmitir && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Completá descripción, cantidad y precio de todos los ítems para poder emitir la nota.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {esCredito
          ? "El sistema calcula los importes y controla que el total acreditado no supere el del comprobante original; si no alcanza, el motivo aparece acá."
          : "El sistema calcula los importes de la nota; si algo no es válido, el motivo aparece acá."}
      </p>

      {resultado && <ResultadoNotaPanel resultado={resultado} />}

      <DialogFooter>
        <Button variant="outline" onClick={onCancelar} disabled={bloqueado}>
          {resultado && resultado.tipo !== "error" ? "Cerrar" : "Cancelar"}
        </Button>
        <Button
          variant={esCredito ? "destructive" : "default"}
          onClick={() => void emitir()}
          // Con la nota pendiente no se emite otra: no se sabe si la primera
          // quedó autorizada y una segunda (con clave nueva) podría duplicar
          // la anulación. Hay que reconciliar primero.
          disabled={!puedeEmitir || bloqueado || resultado?.tipo === "pendiente"}
        >
          {bloqueado
            ? "Emitiendo…"
            : resultado?.tipo === "error"
              ? "Reintentar"
              : esCredito
                ? total
                  ? "Emitir anulación total"
                  : "Emitir nota de crédito"
                : "Emitir nota de débito"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ResultadoNotaPanel({ resultado }: { resultado: ResultadoNota }) {
  if (resultado.tipo === "pendiente") {
    const c = resultado.comprobante;
    return (
      <div role="alert" className={`${CAJA} ${AMBAR} border-2`}>
        <p className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangleIcon className="size-5 shrink-0" />
          La nota quedó pendiente de confirmar con ARCA
        </p>
        {c.motivoError && <p className="mt-2">{c.motivoError}</p>}
        <p className="mt-2">
          Todavía no sabemos si ARCA la autorizó, así que <strong>no la vuelvas a emitir</strong>. Abrí la nota y usá
          «Reconciliar» para consultarlo.
        </p>
        <Link href={`/facturacion/${c.id}`} className="mt-2 inline-block font-medium underline">
          Abrir la nota y reconciliar
        </Link>
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
          {c.estado === "rechazado" ? "ARCA rechazó la nota" : "No se pudo emitir la nota"}
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
          El intento quedó registrado como no autorizado y el comprobante original no cambió. Podés corregir y volver a
          intentar.
        </p>
        <Link href={`/facturacion/${c.id}`} className="mt-2 inline-block font-medium underline">
          Ver el intento
        </Link>
      </div>
    );
  }

  if (resultado.tipo === "error") {
    const { error } = resultado;
    // Sin respuesta, error de servidor o 2xx ilegible: no se sabe si la nota
    // se emitió. Reintentar es seguro: se reusa la misma clave.
    const incierto = error.status === 0 || error.status >= 500 || (error.status >= 200 && error.status < 300);
    return (
      <div role="alert" className={`${CAJA} ${ROJO}`}>
        <p className="flex items-center gap-2 text-base font-semibold">
          <XCircleIcon className="size-5 shrink-0" />
          {incierto ? "No pudimos confirmar si la nota se emitió" : "No se pudo emitir la nota"}
        </p>
        <p className="mt-2">{error.error}</p>
        {error.detalles.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {error.detalles.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
        {incierto && (
          <p className="mt-2">
            Reintentar es seguro: se repite la misma operación y, si la nota ya se había emitido, no se duplica.
          </p>
        )}
      </div>
    );
  }

  return null;
}
