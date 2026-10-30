"use client";

import { useEffect, useState } from "react";
import { PackageSearchIcon } from "lucide-react";
import { fetchFacturacion, formatearMoneda, type Paginado } from "@/app/lib/facturacion";
import type { Producto } from "@/app/lib/productos";
import { ALICUOTA_POR_DEFECTO, MAX_DESCRIPCION } from "@/app/lib/ventasForm";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Qué precio del catálogo se usó para precargar: se le dice al usuario porque
// "con IVA" cambia cómo hay que interpretar el precio de la venta.
export type OrigenPrecio = "neto" | "conIva" | "ninguno";

export type ProductoElegido = {
  descripcion: string;
  /** null si la fila del catálogo no tiene ningún precio. */
  precioUnitario: number | null;
  alicuotaIva: number;
  productoPrecioId: number;
  origenPrecio: OrigenPrecio;
  moneda: string;
};

// Descripción a mostrar de una fila de catálogo: algunas no tienen.
function descripcionDe(p: Producto): string {
  const base = p.descripcion?.trim() || [p.marca, p.skuProveedor ?? p.skuInterno].filter(Boolean).join(" ");
  return base.slice(0, MAX_DESCRIPCION);
}

// Precio sugerido para la venta: el neto; si no hay, el con IVA.
function precioDe(p: Producto): { precio: number | null; origen: OrigenPrecio } {
  if (p.precioNeto !== null) return { precio: p.precioNeto, origen: "neto" };
  if (p.precioConIva !== null) return { precio: p.precioConIva, origen: "conIva" };
  return { precio: null, origen: "ninguno" };
}

// Buscador del catálogo de productos para PRECARGAR un ítem de la venta (no
// vincula nada: el usuario edita todo después). Busca en el backend con
// debounce, solo con el desplegable abierto, y guarda cada respuesta junto con
// el término que la originó: una respuesta lenta de un término viejo no pisa a
// una más nueva, y "buscando…" se deriva sin setState en efectos.
export default function ProductoCatalogoPicker({
  onElegir,
  disabled,
}: {
  onElegir: (producto: ProductoElegido) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [resultados, setResultados] = useState<{ termino: string; items: Producto[]; fallo: boolean } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const params = new URLSearchParams({ pageSize: "20" });
    if (debounced) params.set("search", debounced);
    fetchFacturacion<Paginado<Producto>>(`/api/productos?${params.toString()}`)
      .then((res) => {
        if (active) setResultados({ termino: debounced, items: res.data.items, fallo: false });
      })
      .catch(() => {
        if (active) setResultados({ termino: debounced, items: [], fallo: true });
      });
    return () => {
      active = false;
    };
  }, [open, debounced]);

  const cargando = resultados === null || resultados.termino !== debounced;
  const items = resultados?.items ?? [];

  function elegir(p: Producto) {
    const { precio, origen } = precioDe(p);
    onElegir({
      descripcion: descripcionDe(p),
      precioUnitario: precio,
      alicuotaIva: p.alicuotaIva ?? ALICUOTA_POR_DEFECTO,
      productoPrecioId: p.id,
      origenPrecio: origen,
      moneda: p.moneda,
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" disabled={disabled} />}>
        <PackageSearchIcon />
        Agregar desde el catálogo
      </PopoverTrigger>
      <PopoverContent className="w-[34rem] max-w-[90vw] p-0" align="start">
        {/* shouldFilter={false}: el backend ya filtra; si cmdk volviera a
            filtrar contra el value (el id) escondería coincidencias válidas. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por descripción, marca, SKU o proveedor…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup>
              {items.map((p) => {
                const { precio, origen } = precioDe(p);
                return (
                  <CommandItem key={p.id} value={String(p.id)} onSelect={() => elegir(p)}>
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate">{descripcionDe(p) || "(sin descripción)"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.proveedor?.nombre, p.marca, p.skuProveedor ?? p.skuInterno].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        {precio === null ? (
                          <span className="text-muted-foreground">Sin precio</span>
                        ) : (
                          <>
                            <span className="block font-medium">{formatearMoneda(precio)}</span>
                            <span className="block text-muted-foreground">
                              {origen === "neto" ? "neto" : "con IVA"}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {cargando ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Buscando…</div>
            ) : resultados?.fallo ? (
              <div role="alert" className="py-3 text-center text-xs text-destructive">
                No se pudo buscar en el catálogo.
              </div>
            ) : (
              items.length === 0 && (
                <div className="py-3 text-center text-xs text-muted-foreground">
                  {debounced ? "Ningún producto coincide." : "El catálogo está vacío."}
                </div>
              )
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
