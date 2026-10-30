"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { fetchFacturacion, formatearDocumento, type Cliente, type Paginado } from "@/app/lib/facturacion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const VALOR_CONSUMIDOR_FINAL = "__consumidor_final__";

// Selector de cliente con búsqueda contra el backend (misma idea y debounce
// que ArticuloPicker: la tabla de clientes puede ser grande, así que no se
// trae entera). `elegido === null` significa Consumidor Final (venta sin
// cliente), que es siempre la primera opción.
export default function ClientePicker({
  elegido,
  onChange,
  placeholder = "Consumidor Final",
  className,
}: {
  elegido: Cliente | null;
  onChange: (cliente: Cliente | null) => void;
  /** Texto del botón cuando no hay cliente elegido. */
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  // Cada respuesta guarda el término que la originó: así "cargando" se deriva
  // (término vigente !== término de la última respuesta) sin setState en efectos.
  const [resultados, setResultados] = useState<{ termino: string; items: Cliente[] } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Solo busca con el desplegable abierto: una pantalla con varios pickers no
  // dispara una consulta por cada uno al montarse.
  useEffect(() => {
    if (!open) return;
    let active = true;
    const params = new URLSearchParams({ pageSize: "20" });
    if (debounced) params.set("search", debounced);
    fetchFacturacion<Paginado<Cliente>>(`/api/clientes?${params.toString()}`)
      .then((res) => {
        if (active) setResultados({ termino: debounced, items: res.data.items });
      })
      .catch(() => {
        // Sin resultados el picker queda vacío; la opción Consumidor Final y
        // el resto de la pantalla siguen funcionando.
        if (active) setResultados({ termino: debounced, items: [] });
      });
    return () => {
      active = false;
    };
  }, [open, debounced]);

  const cargando = resultados === null || resultados.termino !== debounced;
  const items = resultados?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-72 justify-between font-normal", className)}
          />
        }
      >
        <span className={cn("truncate", elegido ? "" : "text-muted-foreground")}>
          {elegido ? `${elegido.nombre} — ${formatearDocumento(elegido.tipoDoc, elegido.nroDoc)}` : placeholder}
        </span>
        <ChevronsUpDownIcon className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        {/* shouldFilter={false}: los resultados ya vienen filtrados por el
            backend; si cmdk los volviera a filtrar contra el value (el id),
            escondería coincidencias válidas. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nombre o documento…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value={VALOR_CONSUMIDOR_FINAL}
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <CheckIcon className={cn("size-3.5", elegido ? "opacity-0" : "opacity-100")} />
                Consumidor Final
              </CommandItem>
              {items.map((c) => (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn("size-3.5", elegido?.id === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {c.nombre}
                    <span className="block text-xs text-muted-foreground">
                      {formatearDocumento(c.tipoDoc, c.nroDoc)}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {cargando ? (
              <div className="py-3 text-center text-xs text-muted-foreground">Buscando…</div>
            ) : (
              items.length === 0 && (
                // div y no CommandEmpty: con la opción fija "Consumidor Final"
                // la lista de cmdk nunca queda vacía y no lo mostraría.
                <div className="py-3 text-center text-xs text-muted-foreground">
                  {debounced ? "Ningún cliente coincide." : "Todavía no hay clientes cargados."}
                </div>
              )
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
