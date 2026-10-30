"use client";

import { useState } from "react";
import { InfoIcon, PlusIcon, Trash2Icon } from "lucide-react";
import ProductoCatalogoPicker, { type ProductoElegido } from "@/app/components/facturacion/ProductoCatalogoPicker";
import { formatearMoneda } from "@/app/lib/facturacion";
import {
  ALICUOTAS_IVA,
  MAX_DESCRIPCION,
  MAX_ITEMS_VENTA,
  etiquetaAlicuota,
  evaluarItem,
  itemVacio,
  nuevaClave,
  numeroATexto,
  type ItemFormulario,
} from "@/app/lib/ventasForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ITEMS_ALICUOTA = Object.fromEntries(ALICUOTAS_IVA.map((a) => [String(a), etiquetaAlicuota(a)]));

const GRID = "lg:grid-cols-[minmax(0,1fr)_6.5rem_9rem_7rem_8rem_2rem]";

// Qué se precargó desde el catálogo y qué tiene que revisar el usuario. Se
// guarda estructurado (no como frase) para que el texto siga la tilde de
// "los precios incluyen IVA" si el usuario la cambia después de elegir.
type AvisoPrecarga = {
  clave: string;
  descripcion: string;
  producto: ProductoElegido;
  alicuotaOriginal: number;
};

function textoAviso(a: AvisoPrecarga, preciosIncluyenIva: boolean): string[] {
  const { producto } = a;
  const frases: string[] = [];
  if (producto.origenPrecio === "neto" && producto.precioUnitario !== null) {
    frases.push(`Se precargó el precio neto (sin IVA): ${formatearMoneda(producto.precioUnitario)}.`);
    if (preciosIncluyenIva) {
      frases.push("La venta tiene tildado «Los precios incluyen IVA»: destildalo, o este neto se tomará como precio final.");
    }
  } else if (producto.origenPrecio === "conIva" && producto.precioUnitario !== null) {
    frases.push(
      `El catálogo no tiene precio neto: se precargó el precio con IVA (${formatearMoneda(producto.precioUnitario)}).`,
    );
    if (!preciosIncluyenIva) {
      frases.push("Tildá «Los precios incluyen IVA» para que se interprete bien.");
    }
  } else {
    frases.push("Este producto no tiene precio en el catálogo: completalo a mano.");
  }
  if (producto.moneda && producto.moneda !== "ARS") {
    frases.push(`Ojo: en el catálogo está en ${producto.moneda}, no en pesos.`);
  }
  if (!ALICUOTAS_IVA.some((v) => v === a.alicuotaOriginal)) {
    frases.push(
      `La alícuota del catálogo (${etiquetaAlicuota(a.alicuotaOriginal)}) no está soportada para facturar: se puso 21 %, revisala.`,
    );
  }
  return frases;
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
  const [aviso, setAviso] = useState<AvisoPrecarga | null>(null);
  const lleno = items.length >= MAX_ITEMS_VENTA;

  function cambiar(clave: string, cambios: Partial<ItemFormulario>) {
    onChange(items.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)));
  }

  function agregarVacio() {
    if (lleno) return;
    onChange([...items, itemVacio()]);
  }

  function agregarDeCatalogo(p: ProductoElegido) {
    if (lleno) return;
    const alicuotaValida = ALICUOTAS_IVA.some((v) => v === p.alicuotaIva);
    const item: ItemFormulario = {
      clave: nuevaClave(),
      descripcion: p.descripcion,
      cantidad: "1",
      precioUnitario: p.precioUnitario === null ? "" : numeroATexto(p.precioUnitario),
      alicuotaIva: String(alicuotaValida ? p.alicuotaIva : 21),
      productoPrecioId: p.productoPrecioId,
    };
    onChange([...items, item]);
    setAviso({ clave: item.clave, descripcion: item.descripcion, producto: p, alicuotaOriginal: p.alicuotaIva });
  }

  const avisoVisible = aviso && items.some((i) => i.clave === aviso.clave) ? aviso : null;

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

      {avisoVisible && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">«{avisoVisible.descripcion || "Producto"}» precargado desde el catálogo</p>
            {textoAviso(avisoVisible, preciosIncluyenIva).map((f) => (
              <p key={f}>{f}</p>
            ))}
            <p>Podés editar todo.</p>
          </div>
          <Button type="button" variant="ghost" size="xs" onClick={() => setAviso(null)}>
            Entendido
          </Button>
        </div>
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
