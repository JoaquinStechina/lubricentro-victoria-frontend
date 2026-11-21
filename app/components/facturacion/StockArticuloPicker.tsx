"use client";

import { useEffect, useState } from "react";
import { WarehouseIcon } from "lucide-react";
import { buscarArticulosParaVenta, formatearMoneda, type ArticuloParaVenta } from "@/app/lib/facturacion";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Buscador de artículos del stock para agregar un ítem ya vinculado. Mismo
// patrón que ProductoCatalogoPicker: debounce de 300 ms, solo con el
// desplegable abierto, y cada respuesta etiquetada con su término para que una
// respuesta vieja no pise a una más nueva.
export default function StockArticuloPicker({
  onElegir,
  disabled,
}: {
  onElegir: (articulo: ArticuloParaVenta) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [resultados, setResultados] = useState<{ termino: string; items: ArticuloParaVenta[]; fallo: boolean } | null>(
    null,
  );

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    buscarArticulosParaVenta(debounced)
      .then((items) => {
        if (active) setResultados({ termino: debounced, items, fallo: false });
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

  function elegir(a: ArticuloParaVenta) {
    onElegir(a);
    cambiarAbierto(false);
  }

  // Al cerrar se descartan los resultados: al reabrir no se ven cantidades viejas.
  function cambiarAbierto(abierto: boolean) {
    if (!abierto) setResultados(null);
    setOpen(abierto);
  }

  return (
    <Popover open={open} onOpenChange={cambiarAbierto}>
      <PopoverTrigger render={<Button type="button" variant="outline" disabled={disabled} />}>
        <WarehouseIcon />
        Agregar desde stock
      </PopoverTrigger>
      <PopoverContent className="w-[34rem] max-w-[90vw] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por marca, código o descripción…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandGroup>
              {items.map((a) => (
                <CommandItem key={a.id} value={String(a.id)} onSelect={() => elegir(a)}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{a.descripcion || "(sin descripción)"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[a.marca, a.codigo].filter(Boolean).join(" · ")} · hay {a.cantidad}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      {a.precioSugerido === null ? (
                        <span className="text-muted-foreground">Sin precio</span>
                      ) : (
                        <>
                          <span className="block font-medium">{formatearMoneda(a.precioSugerido)}</span>
                          <span className="block text-muted-foreground">sugerido con IVA</span>
                        </>
                      )}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {cargando ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Buscando…</div>
            ) : resultados?.fallo ? (
              <div role="alert" className="py-3 text-center text-xs text-destructive">
                No se pudo buscar en el stock.
              </div>
            ) : (
              items.length === 0 && (
                <div className="py-3 text-center text-xs text-muted-foreground">
                  {debounced ? "Ningún artículo coincide." : "No hay artículos en el stock."}
                </div>
              )
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
