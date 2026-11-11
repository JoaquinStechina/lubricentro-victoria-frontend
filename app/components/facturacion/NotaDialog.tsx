"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import { AMBAR, CAJA, ROJO } from "@/app/components/facturacion/estilos";
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
  type Previsualizacion,
} from "@/app/lib/facturacion";
import { usePrevisualizacion } from "@/app/lib/usePrevisualizacion";
import { etiquetaAlicuota, itemVacio, itemsParaGuardar, nuevaClave, type ItemFormulario } from "@/app/lib/ventasForm";
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

// Sin respuesta (0), error de servidor o un 2xx ilegible: no se sabe si la nota
// se emitió. El 503 (ARCA sin configurar) es la excepción: el backend lo
// responde ANTES de crear nada, así que es un fracaso definitivo y no una duda.
function esIncierto(error: ErrorApi): boolean {
  return error.status === 0 || (error.status >= 500 && error.status !== 503) || (error.status >= 200 && error.status < 300);
}

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
//
// Como editar el formulario crearía una clave nueva (y una nota de débito no
// tiene tope de saldo que frene un duplicado), tras un fallo INCIERTO el
// formulario queda congelado: solo se puede reintentar (misma clave) o cerrar.
export default function NotaDialog({
  original,
  naturaleza,
  onEmitida,
  onIncierto,
}: {
  original: ComprobanteDetalle;
  naturaleza: Naturaleza;
  /** Se llama con la nota creada (en cualquier estado) para que el padre refresque. */
  onEmitida?: (nota: ComprobanteConItems) => void;
  /**
   * Se llama cuando el pedido falló sin saber si se emitió: la nota pudo haber
   * quedado creada, y el padre tiene que refrescar el detalle para que aparezca
   * en `original.notas` (y funcione la guarda de "nota pendiente").
   */
  onIncierto?: () => void;
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
    else if (esIncierto(final.error)) onIncierto?.();
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

  // Importes de la nota: los calcula el backend (previsualizar) con el MISMO
  // criterio de IVA que el comprobante original; acá solo se muestran. Sin
  // cliente: el cálculo de importes no depende del receptor, y los `errores`
  // de receptor de la respuesta no aplican a una nota (el receptor es el del
  // original), así que se ignoran; los errores de ítems/total llegan como 400.
  const { itemsPreview, calculando, calculo, errorPreview, reintentar } = usePrevisualizacion({
    items,
    clienteId: null,
    preciosIncluyenIva: original.preciosIncluyenIva,
    habilitado: !total,
  });
  // Solo se emite con una vista previa al día y sin error: lo que se ve es lo
  // que el backend va a calcular.
  const puedeEmitir = total || (itemsNota !== undefined && calculo !== null);

  // Tras un fallo incierto el formulario queda congelado (ver NotaDialog).
  const congelado = resultado?.tipo === "error" && esIncierto(resultado.error);

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
  // Con una nota pendiente de confirmar no se emite otra: no se sabe si la
  // primera quedó autorizada y una segunda (con clave nueva) podría duplicar
  // la anulación o el cobro. Se deriva del detalle (que el padre refresca vía
  // onEmitida/onIncierto) y no solo del resultado de este diálogo, para que
  // también valga si se cerró y se reabrió o si la nota pendiente viene de antes.
  const notaPendiente =
    notasPrevias.find((n) => n.estado === "pendiente") ??
    (resultado?.tipo === "pendiente" ? resultado.comprobante : undefined);
  const hayNotaPendiente = notaPendiente !== undefined;

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
          <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">Notas asociadas a este comprobante</p>
          <ul className="flex flex-col gap-1">
            {notasPrevias.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <Link href={`/facturacion/${n.id}`} className="underline">
                  {etiquetaTipo(n.tipo)} {formatearNroComprobante(n.ptoVta, n.nro)}
                </Link>
                <Badge variant={varianteEstado(n.estado)}>{etiquetaEstado(n.estado)}</Badge>
                <span className="tabular-nums">{formatearMoneda(n.impTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {esCredito && (
        <fieldset className="flex flex-col gap-2 text-sm" disabled={bloqueado || congelado}>
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

      {total ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          Se anula el total del comprobante original:{" "}
          <strong className="tabular-nums">{formatearMoneda(original.impTotal)}</strong>. Los ítems se toman del
          original.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Los precios se interpretan {original.preciosIncluyenIva ? "con" : "sin"} IVA, igual que el comprobante
            original.
          </p>
          <ItemsEditor
            items={items}
            onChange={setItems}
            preciosIncluyenIva={original.preciosIncluyenIva}
            disabled={bloqueado || congelado}
          />
          <ResumenNota
            tieneItems={itemsPreview !== null}
            calculando={calculando}
            calculo={calculo}
            error={errorPreview}
            alReintentar={reintentar}
            esCredito={esCredito}
          />
          {itemsNota === undefined && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Completá descripción, cantidad y precio de todos los ítems para poder emitir la nota.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {esCredito
          ? "El sistema controla que el total acreditado no supere el del comprobante original; si no alcanza, el motivo aparece acá."
          : "Si algo de la nota no es válido, el motivo aparece acá."}
      </p>

      {notaPendiente && resultado?.tipo !== "pendiente" && (
        <p role="status" className={`${CAJA} ${AMBAR}`}>
          Hay una nota pendiente de confirmar con ARCA sobre este comprobante (
          <Link href={`/facturacion/${notaPendiente.id}`} className="font-medium underline">
            {etiquetaTipo(notaPendiente.tipo)} {formatearNroComprobante(notaPendiente.ptoVta, notaPendiente.nro)}
          </Link>
          ). Reconciliala desde su detalle antes de emitir otra.
        </p>
      )}

      {resultado && <ResultadoNotaPanel resultado={resultado} />}

      <DialogFooter>
        <Button variant="outline" onClick={onCancelar} disabled={bloqueado}>
          {congelado || (resultado && resultado.tipo !== "error") ? "Cerrar" : "Cancelar"}
        </Button>
        <Button
          variant={esCredito ? "destructive" : "default"}
          onClick={() => void emitir()}
          disabled={!puedeEmitir || bloqueado || hayNotaPendiente}
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

// Importes de la nota según el backend (previsualizar). No hay aritmética
// acá: solo se formatean los números recibidos.
function ResumenNota({
  tieneItems,
  calculando,
  calculo,
  error,
  alReintentar,
  esCredito,
}: {
  tieneItems: boolean;
  calculando: boolean;
  calculo: Previsualizacion | null;
  error: ErrorApi | null;
  alReintentar: () => void;
  esCredito: boolean;
}) {
  if (!tieneItems) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Cargá al menos un ítem con cantidad y precio válidos para ver el importe de la nota.
      </p>
    );
  }
  if (error) {
    return (
      <div role="alert" className={`${CAJA} ${ROJO}`}>
        <p className="font-medium">{error.error}</p>
        {error.detalles.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {error.detalles.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
        {(error.status === 0 || error.status >= 500) && (
          <Button variant="outline" size="sm" className="mt-2" onClick={alReintentar}>
            Reintentar el cálculo
          </Button>
        )}
      </div>
    );
  }
  if (!calculo) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Loader2Icon className="size-4 animate-spin" />
        {calculando ? "Calculando el importe de la nota…" : "Preparando el resumen…"}
      </p>
    );
  }
  return (
    <section
      aria-label="Importe de la nota"
      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h3 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
        {esCredito ? "Se acredita" : "Se cobra de más"} (calculado por el sistema)
      </h3>
      <dl className="flex flex-col gap-0.5 tabular-nums">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-600 dark:text-zinc-400">Neto</dt>
          <dd>{formatearMoneda(calculo.impNeto)}</dd>
        </div>
        {calculo.iva.map((i) => (
          <div key={i.id} className="flex justify-between gap-2">
            <dt className="text-zinc-600 dark:text-zinc-400">
              IVA {etiquetaAlicuota(i.porcentaje)}
              <span className="ml-1 text-xs text-zinc-500">(sobre {formatearMoneda(i.baseImp)})</span>
            </dt>
            <dd>{formatearMoneda(i.importe)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-2 border-t border-zinc-200 pt-1 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
          <dt>Total de la nota</dt>
          <dd>{formatearMoneda(calculo.impTotal)}</dd>
        </div>
      </dl>
    </section>
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
    const incierto = esIncierto(error);
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
        <p className="mt-2">
          {incierto
            ? "Reintentar es seguro: se repite la misma operación y, si la nota ya se había emitido, no se duplica. Para evitar duplicados el formulario queda bloqueado: reintentá, o cerrá y mirá en «Notas asociadas» si la nota ya figura antes de empezar de nuevo."
            : "No se emitió ninguna nota: el comprobante original no cambió."}
        </p>
      </div>
    );
  }

  return null;
}
