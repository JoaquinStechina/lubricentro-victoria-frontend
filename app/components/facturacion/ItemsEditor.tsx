"use client";

import { PlusIcon, TriangleAlertIcon, Trash2Icon } from "lucide-react";
import ProductoCatalogoPicker, { type ProductoElegido } from "@/app/components/facturacion/ProductoCatalogoPicker";
import { formatearMonedaPrecio, formatearMoneda } from "@/app/lib/facturacion";
import {
  ALICUOTAS_IVA,
  MAX_DESCRIPCION,
  MAX_ITEMS_VENTA,
  AVISO_SIN_PRECIO,
  etiquetaAlicuota,
  evaluarItem,
  itemVacio,
  nuevaClave,
  numeroATexto,
  type ItemFormulario,
} from "@/app/lib/ventasForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ITEMS_ALICUOTA = Object.fromEntries(ALICUOTAS_IVA.map((a) => [String(a), etiquetaAlicuota(a)]));

const GRID = "lg:grid-cols-[minmax(0,1fr)_6.5rem_9rem_7rem_8rem_2rem]";

// Solo formato: el número que el usuario tipeó, tal como se leyó. Sirve para
// que "12.500" o "1234,5" no queden librados a la interpretación del lector.
const formatoCantidad = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

// Advertencia cuando la tilde de "los precios incluyen IVA" contradice de dónde
// salió el precio precargado de la fila (neto sin IVA vs. precio con IVA).
function advertenciaIva(origen: ItemFormulario["origenPrecio"], preciosIncluyenIva: boolean): string | null {
  if (origen === "neto" && preciosIncluyenIva) {
    return "Este precio es neto (sin IVA) pero la venta tiene tildado «Los precios incluyen IVA»: se tomaría como precio final.";
  }
  if (origen === "conIva" && !preciosIncluyenIva) {
    return "Este precio ya incluye IVA pero la venta no tiene tildado «Los precios incluyen IVA»: se le sumaría IVA encima.";
  }
  return null;
}

// Filas de la venta. Cada fila tiene una `clave` propia (no el índice) como
// key de React: así quitar o insertar una fila no mueve lo tipeado a otra. Los
// números son texto crudo con error inline: nunca se corrigen en silencio.
// `importes` (opcional) es el total de cada línea según la vista previa del
// backend; este componente no calcula nada.
export default function ItemsEditor({
  items,
  onChange,
  preciosIncluyenIva = false,
  importes = null,
  disabled = false,
}: {
  items: ItemFormulario[];
  onChange: (items: ItemFormulario[]) => void;
  preciosIncluyenIva?: boolean;
  importes?: number[] | null;
  disabled?: boolean;
}) {
  const lleno = items.length >= MAX_ITEMS_VENTA;

  function cambiar(clave: string, cambios: Partial<ItemFormulario>) {
    // Si el usuario toca el precio, el origen del catálogo (chip) y el aviso
    // de "sin precio" dejan de describirlo; el resto de los avisos de la
    // precarga (alícuota forzada a 21 %, moneda no ARS) siguen valiendo.
    onChange(
      items.map((i) => {
        if (i.clave !== clave) return i;
        const extra: Partial<ItemFormulario> =
          cambios.precioUnitario !== undefined
            ? { origenPrecio: null, avisosCatalogo: i.avisosCatalogo.filter((a) => a !== AVISO_SIN_PRECIO) }
            : {};
        return { ...i, ...cambios, ...extra };
      }),
    );
  }

  function agregarVacio() {
    if (lleno) return;
    onChange([...items, itemVacio()]);
  }

  function agregarDeCatalogo(p: ProductoElegido) {
    if (lleno) return;
    const alicuotaValida = ALICUOTAS_IVA.some((v) => v === p.alicuotaIva);
    const avisos: string[] = [];
    if (p.origenPrecio === "ninguno") avisos.push(AVISO_SIN_PRECIO);
    if (p.moneda && p.moneda !== "ARS") avisos.push(`Ojo: en el catálogo está en ${p.moneda}, no en pesos.`);
    if (!alicuotaValida) {
      avisos.push(
        `La alícuota del catálogo (${etiquetaAlicuota(p.alicuotaIva)}) no está soportada para facturar: se puso 21 %, revisala.`,
      );
    }
    onChange([
      ...items,
      {
        clave: nuevaClave(),
        descripcion: p.descripcion,
        cantidad: "1",
        precioUnitario: p.precioUnitario === null ? "" : numeroATexto(p.precioUnitario),
        alicuotaIva: String(alicuotaValida ? p.alicuotaIva : 21),
        productoPrecioId: p.productoPrecioId,
        origenPrecio: p.origenPrecio,
        avisosCatalogo: avisos,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Ítems <span className="font-normal text-zinc-500 dark:text-zinc-400">({items.length} de {MAX_ITEMS_VENTA})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <ProductoCatalogoPicker onElegir={agregarDeCatalogo} disabled={disabled || lleno} />
          <Button type="button" variant="outline" onClick={agregarVacio} disabled={disabled || lleno}>
            <PlusIcon />
            Agregar ítem vacío
          </Button>
        </div>
      </div>
      {lleno && (
        <p role="status" className="text-xs text-zinc-600 dark:text-zinc-400">
          Llegaste al máximo de {MAX_ITEMS_VENTA} ítems por venta.
        </p>
      )}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Todavía no hay ítems. Agregá uno desde el catálogo o escribilo a mano.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            aria-hidden="true"
            className={`hidden gap-2 px-1 text-xs uppercase tracking-wide text-zinc-500 lg:grid dark:text-zinc-400 ${GRID}`}
          >
            <span>Descripción</span>
            <span>Cantidad</span>
            <span>Precio unitario</span>
            <span>IVA</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {items.map((item, idx) => {
            const e = evaluarItem(item);
            const n = idx + 1;
            const importe = importes?.[idx];
            const idBase = `item-${item.clave}`;
            return (
              <div
                key={item.clave}
                className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-950/40"
              >
                <div className={`grid grid-cols-2 items-start gap-2 ${GRID}`}>
                  <div className="col-span-2 lg:col-span-1">
                    <span aria-hidden="true" className="mb-0.5 block text-xs text-zinc-500 lg:hidden dark:text-zinc-400">
                      Descripción
                    </span>
                    <Input
                      id={`${idBase}-desc`}
                      aria-label={`Descripción del ítem ${n}`}
                      value={item.descripcion}
                      maxLength={MAX_DESCRIPCION}
                      onChange={(ev) => cambiar(item.clave, { descripcion: ev.target.value })}
                      placeholder="Qué se vende"
                      autoComplete="off"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <span aria-hidden="true" className="mb-0.5 block text-xs text-zinc-500 lg:hidden dark:text-zinc-400">
                      Cantidad
                    </span>
                    <Input
                      id={`${idBase}-cant`}
                      inputMode="decimal"
                      aria-label={`Cantidad del ítem ${n}`}
                      aria-invalid={e.errorCantidad ? true : undefined}
                      aria-describedby={e.errorCantidad ? `${idBase}-cant-err` : undefined}
                      value={item.cantidad}
                      onChange={(ev) => cambiar(item.clave, { cantidad: ev.target.value })}
                      placeholder="1"
                      autoComplete="off"
                      className="text-right"
                      disabled={disabled}
                    />
                    {e.cantidad !== null && (
                      <p className="mt-0.5 text-right text-xs text-zinc-500 dark:text-zinc-400">
                        = {formatoCantidad.format(e.cantidad)}
                      </p>
                    )}
                  </div>
                  <div>
                    <span aria-hidden="true" className="mb-0.5 block text-xs text-zinc-500 lg:hidden dark:text-zinc-400">
                      Precio unitario
                    </span>
                    <Input
                      id={`${idBase}-precio`}
                      inputMode="decimal"
                      aria-label={`Precio unitario del ítem ${n}`}
                      aria-invalid={e.errorPrecio ? true : undefined}
                      aria-describedby={e.errorPrecio ? `${idBase}-precio-err` : undefined}
                      value={item.precioUnitario}
                      onChange={(ev) => cambiar(item.clave, { precioUnitario: ev.target.value })}
                      placeholder="0,00"
                      autoComplete="off"
                      className="text-right"
                      disabled={disabled}
                    />
                    {e.precioUnitario !== null && (
                      <p className="mt-0.5 text-right text-xs text-zinc-500 dark:text-zinc-400">
                        = {formatearMonedaPrecio(e.precioUnitario)}
                      </p>
                    )}
                  </div>
                  <div>
                    <span aria-hidden="true" className="mb-0.5 block text-xs text-zinc-500 lg:hidden dark:text-zinc-400">
                      IVA
                    </span>
                    <Select
                      items={ITEMS_ALICUOTA}
                      value={item.alicuotaIva}
                      onValueChange={(v) => v && cambiar(item.clave, { alicuotaIva: v })}
                      disabled={disabled}
                    >
                      <SelectTrigger aria-label={`Alícuota de IVA del ítem ${n}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALICUOTAS_IVA.map((a) => (
                          <SelectItem key={a} value={String(a)}>
                            {etiquetaAlicuota(a)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex h-8 items-center justify-end text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    <span aria-hidden="true" className="mr-2 text-xs text-zinc-500 lg:hidden dark:text-zinc-400">
                      Total
                    </span>
                    {importe === undefined || importe === null ? (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    ) : (
                      formatearMoneda(importe)
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar el ítem ${n}`}
                      title="Quitar ítem"
                      onClick={() => onChange(items.filter((i) => i.clave !== item.clave))}
                      disabled={disabled}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
                {(item.origenPrecio || item.avisosCatalogo.length > 0) && (
                  <div className="mt-1.5 flex flex-col gap-0.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      {item.origenPrecio === "neto" && <Badge variant="outline">Precio neto del catálogo</Badge>}
                      {item.origenPrecio === "conIva" && <Badge variant="outline">Precio con IVA del catálogo</Badge>}
                      {item.avisosCatalogo.map((a) => (
                        <span key={a}>{a}</span>
                      ))}
                    </div>
                    {advertenciaIva(item.origenPrecio, preciosIncluyenIva) && (
                      <p
                        role="status"
                        className="flex items-start gap-1 text-amber-800 dark:text-amber-300"
                      >
                        <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
                        {advertenciaIva(item.origenPrecio, preciosIncluyenIva)}
                      </p>
                    )}
                  </div>
                )}
                {(e.errorCantidad || e.errorPrecio) && (
                  <div className="mt-1 flex flex-col gap-0.5 text-xs text-destructive">
                    {e.errorCantidad && (
                      <p id={`${idBase}-cant-err`} role="alert">
                        Cantidad: {e.errorCantidad}
                      </p>
                    )}
                    {e.errorPrecio && (
                      <p id={`${idBase}-precio-err`} role="alert">
                        Precio: {e.errorPrecio}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
