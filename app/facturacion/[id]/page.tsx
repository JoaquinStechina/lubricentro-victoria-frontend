"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, DownloadIcon, Loader2Icon, RefreshCwIcon, XCircleIcon } from "lucide-react";
import EstadoArcaBanner from "@/app/components/facturacion/EstadoArcaBanner";
import FacturacionNav from "@/app/components/facturacion/FacturacionNav";
import NotaDialog from "@/app/components/facturacion/NotaDialog";
import ThemeToggle from "@/app/components/ThemeToggle";
import { API_URL } from "@/app/lib/api";
import {
  ErrorApi,
  admiteNotas,
  condicionIvaPorId,
  esAmbienteDePrueba,
  etiquetaAmbiente,
  etiquetaEstado,
  etiquetaTipo,
  fetchFacturacion,
  formatearDocumento,
  formatearFechaIso,
  formatearMoneda,
  formatearNroComprobante,
  textoObservaciones,
  varianteEstado,
  type ComprobanteConItems,
  type ComprobanteDetalle,
} from "@/app/lib/facturacion";
import { etiquetaAlicuota } from "@/app/lib/ventasForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CAJA = "rounded-lg border px-4 py-3 text-sm";
const ROJO = "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
const AMBAR =
  "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100";
const CELESTE = "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
const TARJETA = "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";

const formatoCantidad = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

// Respuesta etiquetada con la consulta que la originó: "cargando" se deriva
// (clave vigente !== clave de la respuesta) y una respuesta vieja nunca pisa a
// una más nueva, ni al navegar de una nota a otra dentro de esta misma ruta.
type Carga = { clave: string; data: ComprobanteDetalle | null; error: ErrorApi | null };

export default function ComprobanteDetallePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [carga, setCarga] = useState<Carga | null>(null);
  // Cada reintento incrementa el contador y vuelve a disparar el efecto; no se
  // toca estado dentro del efecto.
  const [intento, setIntento] = useState(0);
  const clave = `${id}|${intento}`;

  // Id vigente: un refresco silencioso que llega tarde (el usuario ya navegó a
  // otro comprobante) no debe pisar al comprobante actual.
  const claveVigente = useRef(clave);
  useEffect(() => {
    claveVigente.current = clave;
  }, [clave]);

  useEffect(() => {
    let active = true;
    fetchFacturacion<ComprobanteDetalle>(`/api/facturacion/comprobantes/${encodeURIComponent(id)}`)
      .then((res) => {
        if (active) setCarga({ clave, data: res.data, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setCarga({
            clave,
            data: null,
            error: err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo cargar el comprobante."),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [id, clave]);

  // Vuelve a pedir el detalle sin pasar por "cargando": se usa tras una nota
  // nueva o un 409 al reconciliar, donde la pantalla tiene que seguir en pie.
  async function refrescar() {
    const claveAlPedir = clave;
    try {
      const res = await fetchFacturacion<ComprobanteDetalle>(`/api/facturacion/comprobantes/${encodeURIComponent(id)}`);
      if (claveVigente.current === claveAlPedir) setCarga({ clave: claveAlPedir, data: res.data, error: null });
    } catch {
      // Si falla el refresco se queda lo que ya se estaba mostrando.
    }
  }

  // La respuesta de reconciliar trae la fila actualizada pero no venta,
  // asociado ni notas: se mezcla sobre lo que ya se tenía.
  function actualizar(c: ComprobanteConItems) {
    const claveAlPedir = clave;
    setCarga((prev) =>
      prev && prev.clave === claveAlPedir && prev.data ? { ...prev, data: { ...prev.data, ...c } } : prev,
    );
  }

  const cargando = carga === null || carga.clave !== clave;
  const comprobante = !cargando ? (carga.data ?? null) : null;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/facturacion"
              className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-foreground dark:text-zinc-400"
            >
              <ArrowLeftIcon className="size-3.5" />
              Comprobantes
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              {comprobante
                ? `${etiquetaTipo(comprobante.tipo)} ${formatearNroComprobante(comprobante.ptoVta, comprobante.nro)}`
                : "Comprobante"}
            </h1>
          </div>
          <ThemeToggle />
        </header>

        <FacturacionNav />
        <EstadoArcaBanner />

        {cargando && (
          <p role="status" className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Loader2Icon className="size-4 animate-spin" />
            Cargando el comprobante…
          </p>
        )}
        {!cargando && carga?.error && carga.error.status === 404 && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm text-zinc-800 dark:text-zinc-200">
              No encontramos este comprobante. Puede que el enlace sea viejo o que el número esté mal.
            </p>
            <Button variant="outline" nativeButton={false} render={<Link href="/facturacion" />}>
              Ver todos los comprobantes
            </Button>
          </div>
        )}
        {!cargando && carga?.error && carga.error.status !== 404 && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {carga.error.error}
            </p>
            <Button variant="outline" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </Button>
          </div>
        )}
        {/* Se remonta por comprobante: así el estado de los avisos y de los
            diálogos de notas no se arrastra de una nota a otra. */}
        {comprobante && (
          <Detalle key={comprobante.id} comprobante={comprobante} actualizar={actualizar} refrescar={refrescar} />
        )}
      </main>
    </div>
  );
}

type Aviso = { tipo: "info" | "error"; texto: string; detalles: string[] };

function Detalle({
  comprobante: c,
  actualizar,
  refrescar,
}: {
  comprobante: ComprobanteDetalle;
  actualizar: (c: ComprobanteConItems) => void;
  refrescar: () => Promise<void>;
}) {
  const [reconciliando, setReconciliando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const enVuelo = useRef(false);

  const pendiente = c.estado === "pendiente";
  const fallido = c.estado === "rechazado" || c.estado === "error";
  const prueba = esAmbienteDePrueba(c.ambiente);
  const condicion = condicionIvaPorId(c.receptorCondicionIvaId);
  const urlPdf = `${API_URL}/api/facturacion/comprobantes/${c.id}/pdf`;

  async function reconciliar() {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setReconciliando(true);
    setAviso(null);
    try {
      const res = await fetchFacturacion<ComprobanteConItems>(
        `/api/facturacion/comprobantes/${c.id}/reconciliar`,
        { method: "POST" },
      );
      actualizar(res.data);
      setAviso(
        res.data.estado === "pendiente"
          ? {
              tipo: "info",
              texto: "ARCA todavía no confirma este comprobante: sigue pendiente. Probá de nuevo en unos minutos.",
              detalles: [],
            }
          : { tipo: "info", texto: `Se resolvió: el comprobante figura como ${etiquetaEstado(res.data.estado).toLowerCase()}.`, detalles: [] },
      );
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 409) {
        // 409 = ya no está pendiente (se resolvió solo, por otra emisión o
        // desde otra pestaña): no es una falla, se refresca el estado.
        await refrescar();
        setAviso({
          tipo: "info",
          texto: "Este comprobante ya no estaba pendiente. Se actualizó con su estado actual.",
          detalles: [],
        });
      } else {
        const e = err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo reconciliar el comprobante.");
        setAviso({ tipo: "error", texto: e.error, detalles: e.detalles });
      }
    } finally {
      enVuelo.current = false;
      setReconciliando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={varianteEstado(c.estado)} className="h-6 px-3 text-sm">
          {etiquetaEstado(c.estado)}
        </Badge>
        <Badge variant="outline" title={prueba ? "Sin validez fiscal" : "Con validez fiscal"}>
          Ambiente {etiquetaAmbiente(c.ambiente)}
        </Badge>
      </div>

      {prueba && (
        <p role="status" className={`${CAJA} ${CELESTE}`}>
          <strong>Comprobante de prueba, sin validez fiscal.</strong> Se emitió en el ambiente{" "}
          {etiquetaAmbiente(c.ambiente)}: no vale ante ARCA.
        </p>
      )}

      {pendiente && (
        <div role="alert" className={`${CAJA} ${AMBAR} border-2`}>
          <p className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangleIcon className="size-5 shrink-0" />
            Sin confirmar con ARCA
          </p>
          {c.motivoError && <p className="mt-2">{c.motivoError}</p>}
          <p className="mt-2">
            Hay incertidumbre con ARCA: no sabemos si autorizó este comprobante. <strong>No lo vuelvas a emitir.</strong>{" "}
            El sistema reintenta la consulta solo cuando se emite otro comprobante del mismo tipo, o podés hacerlo a mano
            con «Reconciliar». Puede tardar unos minutos en resolverse. Mientras siga pendiente, la numeración de ese
            tipo de comprobante puede quedar bloqueada.
          </p>
          <div className="mt-3">
            <Button onClick={() => void reconciliar()} disabled={reconciliando}>
              <RefreshCwIcon className={reconciliando ? "animate-spin" : undefined} />
              {reconciliando ? "Consultando a ARCA…" : "Reconciliar"}
            </Button>
          </div>
        </div>
      )}

      {fallido && (
        <div role="alert" className={`${CAJA} ${ROJO}`}>
          <p className="flex items-center gap-2 text-base font-semibold">
            <XCircleIcon className="size-5 shrink-0" />
            {c.estado === "rechazado" ? "ARCA rechazó este comprobante" : "Este comprobante terminó con error"}
          </p>
          {c.motivoError && <p className="mt-2">{c.motivoError}</p>}
          <p className="mt-2">
            No tiene validez: no se autorizó ni consume un número.{" "}
            {c.comprobanteAsociadoId === null
              ? `La venta #${c.venta.id} puede volver a facturarse.`
              : "El comprobante original no cambió: se puede intentar la nota de nuevo."}
          </p>
        </div>
      )}

      {aviso && (
        <div role="status" className={`${CAJA} ${aviso.tipo === "error" ? ROJO : CELESTE}`}>
          <p>{aviso.texto}</p>
          {aviso.detalles.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {aviso.detalles.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(c.estado === "autorizado" || admiteNotas(c.tipo, c.estado)) && (
        <div className="flex flex-wrap gap-2">
          {c.estado === "autorizado" && (
            <Button variant="outline" nativeButton={false} render={<a href={urlPdf} target="_blank" rel="noopener" />}>
              <DownloadIcon />
              Descargar PDF
            </Button>
          )}
          {admiteNotas(c.tipo, c.estado) && (
            <>
              <NotaDialog original={c} naturaleza="credito" onEmitida={() => void refrescar()} />
              <NotaDialog original={c} naturaleza="debito" onEmitida={() => void refrescar()} />
            </>
          )}
        </div>
      )}

      <section className={TARJETA}>
        <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Datos del comprobante</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Fecha de emisión">{formatearFechaIso(c.fechaEmision)}</Dato>
          <Dato titulo="Venta">
            <Link href={`/facturacion?ventaId=${c.venta.id}`} className="underline">
              Venta #{c.venta.id}
            </Link>
          </Dato>
          <Dato titulo="CAE">
            {c.cae ? <span className="font-mono">{c.cae}</span> : <span className="text-zinc-500">—</span>}
          </Dato>
          <Dato titulo="Vencimiento del CAE">
            {c.caeVto ? formatearFechaIso(c.caeVto) : <span className="text-zinc-500">—</span>}
          </Dato>
          <Dato titulo="Precios">{c.preciosIncluyenIva ? "Incluyen IVA" : "Sin IVA"}</Dato>
          {c.asociado && (
            <Dato titulo="Comprobante asociado">
              <Link href={`/facturacion/${c.asociado.id}`} className="underline">
                {etiquetaTipo(c.asociado.tipo)} {formatearNroComprobante(c.asociado.ptoVta, c.asociado.nro)}
              </Link>
            </Dato>
          )}
        </dl>
      </section>

      <section className={TARJETA}>
        <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Receptor</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato titulo="Nombre">{c.receptorNombre}</Dato>
          <Dato titulo="Documento">
            {c.receptorDocTipo === 99 ? "Sin identificar" : formatearDocumento(c.receptorDocTipo, c.receptorDocNro)}
          </Dato>
          <Dato titulo="Condición frente al IVA">{condicion?.nombre ?? `Condición ${c.receptorCondicionIvaId}`}</Dato>
          <Dato titulo="Domicilio">
            {c.receptorDomicilio ?? <span className="text-zinc-500 dark:text-zinc-400">No informado</span>}
          </Dato>
        </dl>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="px-4 pt-4 pb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Ítems</h2>
        <Table>
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Precio unitario</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.isArray(c.items) && c.items.length > 0 ? (
              c.items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-normal text-zinc-900 dark:text-zinc-100">{it.descripcion}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatoCantidad.format(it.cantidad)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(it.precioUnitario)}</TableCell>
                  <TableCell className="text-right tabular-nums">{etiquetaAlicuota(it.alicuotaIva)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {formatearMoneda(it.total)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-zinc-500 dark:text-zinc-400">
                  Este comprobante no tiene ítems registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className={`${TARJETA} ml-auto w-full sm:max-w-sm`}>
        <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Totales</h2>
        <dl className="flex flex-col gap-1.5 text-sm tabular-nums">
          <Fila etiqueta="Neto">{formatearMoneda(c.impNeto)}</Fila>
          {Array.isArray(c.iva) &&
            c.iva.map((a, i) => (
              <Fila
                key={`${a.id}-${i}`}
                etiqueta={`IVA ${etiquetaAlicuota(a.porcentaje)} (sobre ${formatearMoneda(a.baseImp)})`}
              >
                {formatearMoneda(a.importe)}
              </Fila>
            ))}
          <Fila etiqueta="Total IVA">{formatearMoneda(c.impIva)}</Fila>
          <div className="mt-1 flex items-baseline justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
            <dt>Total</dt>
            <dd>{formatearMoneda(c.impTotal)}</dd>
          </div>
        </dl>
      </section>

      <ObservacionesArca observaciones={c.observaciones} />

      {c.notas.length > 0 && (
        <section className={TARJETA}>
          <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Notas sobre este comprobante</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {c.notas.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3">
                <Link href={`/facturacion/${n.id}`} className="font-medium underline">
                  {etiquetaTipo(n.tipo)} {formatearNroComprobante(n.ptoVta, n.nro)}
                </Link>
                <Badge variant={varianteEstado(n.estado)}>{etiquetaEstado(n.estado)}</Badge>
                <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{formatearMoneda(n.impTotal)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{titulo}</dt>
      <dd className="mt-0.5 break-words text-zinc-900 dark:text-zinc-100">{children}</dd>
    </div>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-zinc-700 dark:text-zinc-300">
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const MAX_CRUDO = 4000;

// Las observaciones de ARCA son JSON sin forma garantizada. Lo que tiene la
// forma esperada ([{codigo, mensaje}] o frases) se muestra como lista; lo que
// no, se muestra como texto plano (React lo escapa; nunca se inyecta HTML) y
// acotado, para que un valor enorme o raro no rompa la pantalla.
function ObservacionesArca({ observaciones }: { observaciones: unknown }) {
  if (observaciones === null || observaciones === undefined) return null;
  const lista = Array.isArray(observaciones) ? observaciones : null;
  if (lista && lista.length === 0) return null;
  const frases = textoObservaciones(observaciones);
  // Hay algo que la lista no pudo interpretar: se muestra además en crudo.
  const hayCrudo = !lista || lista.length > frases.length;
  let crudo = "";
  if (hayCrudo) {
    try {
      crudo = typeof observaciones === "string" ? observaciones : (JSON.stringify(observaciones, null, 2) ?? "");
    } catch {
      crudo = "(no se pudo mostrar)";
    }
    if (crudo.length > MAX_CRUDO) crudo = `${crudo.slice(0, MAX_CRUDO)}…`;
  }
  if (frases.length === 0 && crudo === "") return null;
  return (
    <section className={`${CAJA} ${AMBAR}`}>
      <h2 className="mb-1 font-semibold">Observaciones de ARCA</h2>
      {frases.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5">
          {frases.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
      {crudo !== "" && (
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-black/5 p-2 text-xs break-words whitespace-pre-wrap dark:bg-white/10">
          {crudo}
        </pre>
      )}
    </section>
  );
}
