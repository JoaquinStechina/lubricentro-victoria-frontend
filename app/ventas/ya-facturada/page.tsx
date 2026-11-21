"use client";

// Registrar una venta que YA se facturó por otro medio (por ejemplo en
// Comprobantes en línea). Queda en el historial con los datos de su factura y
// NUNCA se informa a ARCA: sería facturar dos veces la misma venta. Por eso
// esta pantalla no usa useEmitirFactura ni ofrece "Facturar", y el backend
// (POST /api/ventas/externas) rechaza cualquier intento de emitirla.

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CheckCircle2Icon, InfoIcon, Loader2Icon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import ClienteDialog from "@/app/components/facturacion/ClienteDialog";
import ClientePicker from "@/app/components/facturacion/ClientePicker";
import FacturacionNav from "@/app/components/facturacion/FacturacionNav";
import ItemsEditor from "@/app/components/facturacion/ItemsEditor";
import ThemeToggle from "@/app/components/ThemeToggle";
import {
  ErrorApi,
  formatearMoneda,
  referenciaFacturaExterna,
  registrarVentaExterna,
  type Cliente,
  type FacturaExterna,
  type Previsualizacion,
  type VentaDetalle,
} from "@/app/lib/facturacion";
import { usePrevisualizacion } from "@/app/lib/usePrevisualizacion";
import { evaluarItem, itemsParaGuardar, type ItemFormulario } from "@/app/lib/ventasForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const MAX_OBSERVACIONES = 500;
// Topes de ARCA, los mismos que valida el backend.
const MAX_PTO_VTA = 99999;
const MAX_NRO = 99999999;

// Solo facturas A y B: el emisor es Responsable Inscripto. B primero porque es
// la de mostrador (consumidor final).
const TIPOS_FACTURA = [
  { tipo: 6, clase: "B", nombre: "Factura B" },
  { tipo: 1, clase: "A", nombre: "Factura A" },
] as const;

// Hoy en la fecha local del navegador, como YYYY-MM-DD (lo que usa <input type="date">).
function hoyLocal(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

// Entero entre 1 y `max` a partir de lo tipeado (solo dígitos); null si no.
function enteroDesde(texto: string, max: number): number | null {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  return n >= 1 && n <= max ? n : null;
}

// Se remonta el formulario con otra `key` para "Registrar otra": empieza de
// cero sin resetear cada campo a mano (mismo patrón que Nueva venta).
export default function VentaYaFacturadaPage() {
  const [intento, setIntento] = useState(0);
  return <RegistrarVentaYaFacturada key={intento} onOtra={() => setIntento((n) => n + 1)} />;
}

function RegistrarVentaYaFacturada({ onOtra }: { onOtra: () => void }) {
  // Fijo mientras dure el formulario (inicializador perezoso, no se recalcula por render).
  const [hoy] = useState(hoyLocal);
  const [tipo, setTipo] = useState<number>(TIPOS_FACTURA[0].tipo);
  const [ptoVtaTexto, setPtoVtaTexto] = useState("");
  const [nroTexto, setNroTexto] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [avisoCliente, setAvisoCliente] = useState<string | null>(null);
  const [preciosIncluyenIva, setPreciosIncluyenIva] = useState(true);
  const [items, setItems] = useState<ItemFormulario[]>([]);
  const [observaciones, setObservaciones] = useState("");

  const [registrada, setRegistrada] = useState<VentaDetalle | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<ErrorApi | null>(null);
  // Ref además del estado: dos clics en el mismo tick leen `guardando` viejo.
  const enVueloRef = useRef(false);

  const bloqueado = registrada !== null;

  // Solo para mostrar líneas y totales. Los `errores` de la previsualización
  // son reglas para emitir por ARCA y acá no aplican: no se muestran.
  const { itemsPreview, previewAlDia, calculando, calculo, errorPreview, reintentar } = usePrevisualizacion({
    items,
    clienteId: cliente?.id ?? null,
    preciosIncluyenIva,
  });

  // ---- Datos de la factura -------------------------------------------------
  const ptoVta = enteroDesde(ptoVtaTexto, MAX_PTO_VTA);
  const nro = enteroDesde(nroTexto, MAX_NRO);
  const factura: FacturaExterna | null = ptoVta !== null && nro !== null ? { tipo, ptoVta, nro } : null;
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= hoy;
  const errorPtoVta = ptoVtaTexto.trim() !== "" && ptoVta === null;
  const errorNro = nroTexto.trim() !== "" && nro === null;

  // ---- Qué se puede hacer ------------------------------------------------
  const itemsGuardar = useMemo(() => itemsParaGuardar(items), [items]);
  const evaluaciones = items.map(evaluarItem);
  const hayNumerosInvalidos = evaluaciones.some((e) => e.errorCantidad || e.errorPrecio);
  const hayIncompletos = evaluaciones.some((e) => e.incompleto);

  const puedeRegistrar =
    factura !== null && fechaValida && itemsGuardar !== null && calculo !== null && !guardando && !bloqueado;

  let motivo: string | null = null;
  if (!bloqueado) {
    if (ptoVtaTexto.trim() === "" || nroTexto.trim() === "") motivo = "Completá el punto de venta y el número de la factura.";
    else if (ptoVta === null) motivo = `El punto de venta tiene que ser un número entre 1 y ${MAX_PTO_VTA}.`;
    else if (nro === null) motivo = `El número de factura tiene que ser un número entre 1 y ${MAX_NRO}.`;
    else if (!fechaValida) motivo = fecha === "" ? "Completá la fecha de la factura." : "La fecha no puede ser posterior a hoy.";
    else if (items.length === 0) motivo = "Agregá al menos un ítem.";
    else if (hayNumerosInvalidos) motivo = "Corregí los números marcados en rojo.";
    else if (hayIncompletos) motivo = "Completá descripción, cantidad y precio de todos los ítems.";
    else if (calculando) motivo = "Calculando el resumen…";
    else if (errorPreview) motivo = "No se pudo calcular el resumen: revisá el aviso de la derecha.";
  }

  // La clase que saldría para este cliente no coincide con la elegida: se
  // avisa sin bloquear, porque se registra una factura que ya existe.
  const claseElegida = TIPOS_FACTURA.find((t) => t.tipo === tipo)?.clase;
  const avisoClase =
    calculo && previewAlDia && claseElegida && calculo.clase !== claseElegida
      ? `Para este cliente correspondería Factura ${calculo.clase}. Revisá que el tipo coincida con la factura real.`
      : null;

  // ---- Acción ------------------------------------------------------------
  async function registrar() {
    if (enVueloRef.current || factura === null) return;
    const itemsVenta = itemsParaGuardar(items);
    if (itemsVenta === null) return;
    enVueloRef.current = true;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const res = await registrarVentaExterna({
        clienteId: cliente?.id ?? null,
        fecha,
        preciosIncluyenIva,
        items: itemsVenta,
        observaciones: observaciones.trim() || null,
        factura,
      });
      setRegistrada(res.data);
    } catch (err) {
      setErrorGuardar(err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo registrar la venta."));
    } finally {
      enVueloRef.current = false;
      setGuardando(false);
    }
  }

  // Sin respuesta (red, timeout, 5xx) no se sabe si se registró. Reintentar es
  // seguro: la misma factura no se puede registrar dos veces (el backend
  // responde 409 diciendo en qué venta está).
  const incierto = errorGuardar !== null && (errorGuardar.status === 0 || errorGuardar.status >= 500);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            {guardando ? (
              <span
                aria-disabled="true"
                className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-400 dark:text-zinc-600"
              >
                <ArrowLeftIcon className="size-3.5" />
                Ventas
              </span>
            ) : (
              <Link
                href="/ventas"
                className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-foreground dark:text-zinc-400"
              >
                <ArrowLeftIcon className="size-3.5" />
                Ventas
              </Link>
            )}
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Registrar venta ya facturada
            </h1>
          </div>
          <ThemeToggle />
        </header>

        <FacturacionNav />

        <div
          role="note"
          className="mb-4 flex gap-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Esta venta no se informa a ARCA.</p>
            <p className="mt-1">
              Usala solo para ventas que ya facturaste por otro medio (por ejemplo, Comprobantes en línea). Queda en el
              historial con los datos de su factura y el sistema no permite facturarla. Si todavía no la facturaste, usá{" "}
              <Link href="/ventas/nueva" className="font-medium underline">
                Nueva venta
              </Link>
              .
            </p>
          </div>
        </div>

        {registrada && (
          <section className="mb-4" aria-live="polite">
            <div
              role="status"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2Icon className="size-4 shrink-0" />
                Venta #{registrada.id} registrada
                {registrada.facturaExterna ? ` (${referenciaFacturaExterna(registrada.facturaExterna)})` : ""}.
              </p>
              <p className="mt-1">No se informó nada a ARCA: figura en Ventas como «Facturada por fuera».</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" nativeButton={false} render={<Link href="/ventas" />}>
                  Ver ventas
                </Button>
                <Button variant="outline" onClick={onOtra}>
                  <PlusIcon />
                  Registrar otra
                </Button>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div
            inert={bloqueado}
            className={`flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${bloqueado ? "opacity-60" : ""}`}
          >
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">Factura emitida</legend>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Tipo</span>
                  <div role="group" aria-label="Tipo de factura" className="flex gap-1">
                    {TIPOS_FACTURA.map((t) => (
                      <Button
                        key={t.tipo}
                        type="button"
                        variant={tipo === t.tipo ? "default" : "outline"}
                        aria-pressed={tipo === t.tipo}
                        onClick={() => setTipo(t.tipo)}
                      >
                        {t.nombre}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex w-28 flex-col gap-1.5">
                  <Label htmlFor="factura-ptovta">Punto de venta</Label>
                  <Input
                    id="factura-ptovta"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ej: 1"
                    value={ptoVtaTexto}
                    aria-invalid={errorPtoVta || undefined}
                    onChange={(e) => setPtoVtaTexto(e.target.value)}
                  />
                </div>
                <div className="flex w-36 flex-col gap-1.5">
                  <Label htmlFor="factura-nro">Número</Label>
                  <Input
                    id="factura-nro"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ej: 6001"
                    value={nroTexto}
                    aria-invalid={errorNro || undefined}
                    onChange={(e) => setNroTexto(e.target.value)}
                  />
                </div>
                <div className="flex w-44 flex-col gap-1.5">
                  <Label htmlFor="factura-fecha">Fecha de la factura</Label>
                  <Input
                    id="factura-fecha"
                    type="date"
                    max={hoy}
                    value={fecha}
                    aria-invalid={!fechaValida || undefined}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
              </div>
              {factura && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Se registra como <span className="font-mono">{referenciaFacturaExterna(factura)}</span>.
                </p>
              )}
            </fieldset>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Cliente</Label>
                <div className="flex flex-wrap gap-2">
                  <ClientePicker elegido={cliente} onChange={setCliente} />
                  <ClienteDialog
                    cliente={null}
                    onGuardado={(c) => {
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
              <ResumenTotales
                tieneItems={itemsPreview !== null}
                calculando={calculando}
                calculo={previewAlDia ? calculo : null}
                error={errorPreview}
                alReintentar={reintentar}
              />
              {avisoClase && (
                <p
                  role="status"
                  className="mt-3 flex gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                  {avisoClase}
                </p>
              )}
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
                    {incierto ? (
                      <p className="mt-1">
                        No sabemos si llegó a registrarse. Podés reintentar: si ya se había registrado, el sistema avisa
                        que esa factura ya está registrada y no la duplica.
                      </p>
                    ) : (
                      <p className="mt-1">La venta no se registró.</p>
                    )}
                  </div>
                )}
                <Button size="lg" onClick={() => void registrar()} disabled={!puedeRegistrar}>
                  {guardando ? "Registrando…" : "Registrar venta"}
                </Button>
                {motivo && <p className="text-xs text-zinc-600 dark:text-zinc-400">{motivo}</p>}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

// Totales calculados por el backend (previsualizar); acá solo se formatean. A
// diferencia del resumen de Nueva venta, no dice qué comprobante "se emite":
// acá no se emite nada.
function ResumenTotales({
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
    <dl className="flex flex-col gap-1 text-sm tabular-nums">
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
  );
}
