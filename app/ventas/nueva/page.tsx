"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CheckCircle2Icon, Loader2Icon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import ClientePicker from "@/app/components/facturacion/ClientePicker";
import ClienteDialog from "@/app/components/facturacion/ClienteDialog";
import EstadoArcaBanner from "@/app/components/facturacion/EstadoArcaBanner";
import FacturacionNav from "@/app/components/facturacion/FacturacionNav";
import ItemsEditor from "@/app/components/facturacion/ItemsEditor";
import ResultadoEmisionPanel from "@/app/components/facturacion/ResultadoEmisionPanel";
import ThemeToggle from "@/app/components/ThemeToggle";
import {
  ErrorApi,
  etiquetaTipo,
  fetchFacturacion,
  formatearMoneda,
  jsonInit,
  type Cliente,
  type Previsualizacion,
  type VentaDetalle,
} from "@/app/lib/facturacion";
import { useEmitirFactura } from "@/app/lib/useEmitirFactura";
import { evaluarItem, itemsParaGuardar, itemsParaPrevisualizar, type ItemFormulario } from "@/app/lib/ventasForm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const MAX_OBSERVACIONES = 500;
const DEBOUNCE_PREVIEW_MS = 300;

// Resultado de una vista previa, etiquetado con la consulta que lo originó
// (`clave`): "está al día" se deriva comparando con la consulta vigente, así
// una respuesta vieja y lenta nunca se muestra como si fuera la actual.
type ResultadoPreview =
  | { clave: string; ok: true; data: Previsualizacion }
  | { clave: string; ok: false; error: ErrorApi };

// Se remonta el formulario entero con otra `key` para "Cargar otra venta": es
// la forma de empezar de cero sin copiar props a estado ni resetear a mano.
export default function NuevaVentaPage() {
  const [intento, setIntento] = useState(0);
  return <NuevaVenta key={intento} onOtraVenta={() => setIntento((n) => n + 1)} />;
}

function NuevaVenta({ onOtraVenta }: { onOtraVenta: () => void }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [avisoCliente, setAvisoCliente] = useState<string | null>(null);
  const [preciosIncluyenIva, setPreciosIncluyenIva] = useState(false);
  const [items, setItems] = useState<ItemFormulario[]>([]);
  const [observaciones, setObservaciones] = useState("");

  // La venta guardada es inmutable (no hay edición): mientras exista, el
  // formulario se bloquea y "reintentar" solo repite la facturación.
  const [ventaGuardada, setVentaGuardada] = useState<VentaDetalle | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<ErrorApi | null>(null);
  // Ref además del estado: dos clics en el mismo tick leen `guardando` viejo.
  const enVueloRef = useRef(false);
  const { emitir, emitiendoId, resultado, limpiarResultado } = useEmitirFactura();

  const bloqueado = ventaGuardada !== null;

  // ---- Vista previa (única fuente de totales: el backend) -----------------
  const itemsPreview = useMemo(() => itemsParaPrevisualizar(items), [items]);
  // Lo único que cambia el cálculo: cliente, tilde de IVA y cantidad/precio/
  // alícuota. Descripción y observaciones no, para no consultar por cada tecla.
  const claveConsulta = useMemo(
    () =>
      itemsPreview ? JSON.stringify({ clienteId: cliente?.id ?? null, preciosIncluyenIva, items: itemsPreview }) : null,
    [itemsPreview, cliente, preciosIncluyenIva],
  );
  const [reintentoPreview, setReintentoPreview] = useState(0);
  const claveVigente = claveConsulta ? `${reintentoPreview}|${claveConsulta}` : null;

  const [claveDebounced, setClaveDebounced] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setClaveDebounced(claveVigente), DEBOUNCE_PREVIEW_MS);
    return () => clearTimeout(id);
  }, [claveVigente]);

  const [preview, setPreview] = useState<ResultadoPreview | null>(null);
  useEffect(() => {
    if (claveDebounced === null) return;
    let active = true;
    // El cuerpo se arma desde la propia clave: lo que se consulta es
    // exactamente lo que identifica el resultado.
    const cuerpo = claveDebounced.slice(claveDebounced.indexOf("|") + 1);
    fetchFacturacion<Previsualizacion>("/api/ventas/previsualizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cuerpo,
    })
      .then((res) => {
        if (active) setPreview({ clave: claveDebounced, ok: true, data: res.data });
      })
      .catch((err: unknown) => {
        if (active) {
          setPreview({
            clave: claveDebounced,
            ok: false,
            error: err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo calcular el resumen."),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [claveDebounced]);

  // Está al día solo si es la respuesta a la consulta vigente. Mientras tanto
  // (tipeando, request en vuelo) el resumen se atenúa y no se puede guardar.
  const previewAlDia = preview !== null && claveVigente !== null && preview.clave === claveVigente;
  const calculando = claveVigente !== null && !previewAlDia;
  const calculo = previewAlDia && preview.ok ? preview.data : null;
  const errorPreview = previewAlDia && !preview.ok ? preview.error : null;

  // ---- Qué se puede hacer ------------------------------------------------
  const itemsGuardar = useMemo(() => itemsParaGuardar(items), [items]);
  const evaluaciones = items.map(evaluarItem);
  const hayNumerosInvalidos = evaluaciones.some((e) => e.errorCantidad || e.errorPrecio);
  const hayIncompletos = evaluaciones.some((e) => e.incompleto);
  const erroresArca = calculo?.errores ?? [];

  const puedeGuardar = itemsGuardar !== null && calculo !== null && !guardando && emitiendoId === null && !bloqueado;
  const puedeFacturar = puedeGuardar && erroresArca.length === 0;

  let motivoGuardar: string | null = null;
  if (!bloqueado) {
    if (items.length === 0) motivoGuardar = "Agregá al menos un ítem.";
    else if (hayNumerosInvalidos) motivoGuardar = "Corregí los números marcados en rojo.";
    else if (hayIncompletos) motivoGuardar = "Completá descripción, cantidad y precio de todos los ítems.";
    else if (calculando) motivoGuardar = "Calculando el resumen…";
    else if (errorPreview) motivoGuardar = "No se pudo calcular el resumen: revisá el aviso de la derecha.";
  }
  const motivoFacturar = !bloqueado && puedeGuardar && erroresArca.length > 0
    ? "No se puede facturar todavía (ver los avisos del resumen), pero podés guardar la venta igual."
    : null;

  // ---- Acciones ----------------------------------------------------------
  // Crea la venta (una sola vez) y, si se pidió, la factura. Si ya existe una
  // venta guardada se reutiliza su id: reintentar nunca crea otra venta.
  async function guardar(facturar: boolean) {
    if (enVueloRef.current) return;
    enVueloRef.current = true;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      let venta = ventaGuardada;
      if (venta === null) {
        const itemsVenta = itemsParaGuardar(items);
        if (itemsVenta === null) return;
        const res = await fetchFacturacion<VentaDetalle>(
          "/api/ventas",
          jsonInit(
            {
              clienteId: cliente?.id ?? null,
              preciosIncluyenIva,
              items: itemsVenta,
              observaciones: observaciones.trim() || null,
            },
            "POST",
          ),
        );
        venta = res.data;
        setVentaGuardada(venta);
      }
      if (facturar) await emitir(venta.id);
    } catch (err) {
      setErrorGuardar(err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo guardar la venta."));
    } finally {
      enVueloRef.current = false;
      setGuardando(false);
    }
  }

  // Un fallo sin respuesta (red, timeout, 5xx) no dice si la venta se guardó:
  // POST /api/ventas no es idempotente, así que se avisa en vez de reintentar a ciegas.
  const guardadoIncierto = errorGuardar !== null && (errorGuardar.status === 0 || errorGuardar.status >= 500);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/ventas"
              className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-foreground dark:text-zinc-400"
            >
              <ArrowLeftIcon className="size-3.5" />
              Ventas
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Nueva venta</h1>
          </div>
          <ThemeToggle />
        </header>

        <FacturacionNav />
        <EstadoArcaBanner />

        {ventaGuardada && (
          <section className="mb-4 flex flex-col gap-3" aria-live="polite">
            <div
              role="status"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2Icon className="size-4 shrink-0" />
                Venta #{ventaGuardada.id} guardada.
              </p>
              {!resultado && emitiendoId === null && (
                <p className="mt-1">Todavía no está facturada: podés facturarla ahora o hacerlo después desde Ventas.</p>
              )}
              {emitiendoId !== null && !resultado && (
                <p className="mt-1 flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Facturando… no cierres ni recargues la página.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {!resultado && (
                  <Button
                    onClick={() => void emitir(ventaGuardada.id)}
                    disabled={emitiendoId !== null || guardando}
                  >
                    {emitiendoId !== null ? "Facturando…" : "Facturar ahora"}
                  </Button>
                )}
                <Button variant="outline" nativeButton={false} render={<Link href="/ventas" />}>
                  Ver ventas
                </Button>
                <Button variant="outline" onClick={onOtraVenta} disabled={emitiendoId !== null}>
                  <PlusIcon />
                  Cargar otra venta
                </Button>
              </div>
            </div>
            {resultado && (
              <ResultadoEmisionPanel
                resultado={resultado}
                reintentando={emitiendoId !== null}
                onReintentar={() => void emitir(ventaGuardada.id)}
                onCerrar={resultado.tipo === "autorizado" ? undefined : limpiarResultado}
              />
            )}
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div
            inert={bloqueado}
            className={`flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${bloqueado ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Cliente</Label>
                <div className="flex flex-wrap gap-2">
                  <ClientePicker elegido={cliente} onChange={setCliente} />
                  <ClienteDialog
                    cliente={null}
                    onGuardado={(c) => {
                      // Sin cliente = se restauró uno eliminado pero no se pudo
                      // traer su ficha: la selección no cambia.
                      if (c) {
                        setCliente(c);
                        setAvisoCliente(null);
                      } else {
                        setAvisoCliente("Se restauró el cliente, pero no pudimos cargarlo: buscalo en el selector.");
                      }
                    }}
                    trigger={
                      <Button type="button" variant="outline">
                        <PlusIcon />
                        Nuevo cliente
                      </Button>
                    }
                  />
                </div>
                {avisoCliente && (
                  <p role="status" className="text-xs text-zinc-600 dark:text-zinc-400">
                    {avisoCliente}
                  </p>
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-sm">
                <Switch checked={preciosIncluyenIva} onCheckedChange={setPreciosIncluyenIva} />
                <span className="text-zinc-700 dark:text-zinc-300">Los precios incluyen IVA</span>
              </label>
            </div>

            <ItemsEditor
              items={items}
              onChange={setItems}
              preciosIncluyenIva={preciosIncluyenIva}
              importes={previewAlDia && calculo && calculo.lineas.length === items.length ? calculo.lineas.map((l) => l.total) : null}
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="venta-observaciones">Observaciones (opcional)</Label>
              <Textarea
                id="venta-observaciones"
                value={observaciones}
                maxLength={MAX_OBSERVACIONES}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas internas de la venta"
              />
            </div>
          </div>

          <aside className="flex flex-col gap-3 self-start lg:sticky lg:top-6">
            <section
              aria-label="Resumen de la venta"
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Resumen</h2>
              <Resumen
                tieneItems={itemsPreview !== null}
                calculando={calculando}
                calculo={previewAlDia ? calculo : null}
                error={errorPreview}
                alReintentar={() => setReintentoPreview((n) => n + 1)}
              />
            </section>

            {!bloqueado && (
              <div className="flex flex-col gap-2">
                {errorGuardar && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                  >
                    <p className="font-medium">{errorGuardar.error}</p>
                    {errorGuardar.detalles.length > 0 && (
                      <ul className="mt-1 list-disc pl-5">
                        {errorGuardar.detalles.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                    {guardadoIncierto ? (
                      <p className="mt-1">
                        No sabemos si la venta llegó a guardarse. Antes de volver a guardar, mirá si ya figura en{" "}
                        <Link href="/ventas" target="_blank" className="underline">
                          Ventas
                        </Link>{" "}
                        (se abre en otra pestaña) para no cargarla dos veces.
                      </p>
                    ) : (
                      <p className="mt-1">La venta no se guardó.</p>
                    )}
                  </div>
                )}
                <Button size="lg" onClick={() => void guardar(true)} disabled={!puedeFacturar}>
                  {guardando ? "Guardando…" : "Guardar y facturar"}
                </Button>
                <Button size="lg" variant="outline" onClick={() => void guardar(false)} disabled={!puedeGuardar}>
                  Guardar venta
                </Button>
                {motivoGuardar && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{motivoGuardar}</p>
                )}
                {motivoFacturar && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{motivoFacturar}</p>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

// Panel de totales. Todos los números vienen del backend (previsualizar): acá
// solo se formatean.
function Resumen({
  tieneItems,
  calculando,
  calculo,
  error,
  alReintentar,
}: {
  tieneItems: boolean;
  calculando: boolean;
  calculo: Previsualizacion | null;
  error: ErrorApi | null;
  alReintentar: () => void;
}) {
  if (!tieneItems) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Cargá al menos un ítem con cantidad y precio válidos para ver los totales.
      </p>
    );
  }
  if (error) {
    return (
      <div role="alert" className="text-sm text-red-800 dark:text-red-300">
        <p className="font-medium">{error.error}</p>
        {error.detalles.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {error.detalles.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
        {error.status === 0 || error.status >= 500 ? (
          <Button variant="outline" size="sm" className="mt-2" onClick={alReintentar}>
            Reintentar
          </Button>
        ) : null}
      </div>
    );
  }
  if (!calculo) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Loader2Icon className="size-4 animate-spin" />
        {calculando ? "Calculando…" : "Preparando el resumen…"}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="flex items-center justify-between gap-2">
        <span className="text-zinc-600 dark:text-zinc-400">Se emite</span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{etiquetaTipo(calculo.tipoComprobante)}</span>
      </p>
      <dl className="flex flex-col gap-1 tabular-nums">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-600 dark:text-zinc-400">Neto gravado</dt>
          <dd>{formatearMoneda(calculo.impNeto)}</dd>
        </div>
        {calculo.iva.map((i) => (
          <div key={i.id} className="flex justify-between gap-2">
            <dt className="text-zinc-600 dark:text-zinc-400">
              IVA {String(i.porcentaje).replace(".", ",")} %
              <span className="ml-1 text-xs text-zinc-500">(sobre {formatearMoneda(i.baseImp)})</span>
            </dt>
            <dd>{formatearMoneda(i.importe)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-600 dark:text-zinc-400">IVA total</dt>
          <dd>{formatearMoneda(calculo.impIva)}</dd>
        </div>
        <div className="mt-1 flex justify-between gap-2 border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
          <dt>Total</dt>
          <dd>{formatearMoneda(calculo.impTotal)}</dd>
        </div>
      </dl>
      {calculo.errores.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlertIcon className="size-4 shrink-0" />
            No se puede facturar así
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {calculo.errores.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
