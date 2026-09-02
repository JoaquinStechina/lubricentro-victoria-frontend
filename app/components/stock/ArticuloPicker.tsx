"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import type { ArticuloStock } from "@/app/lib/stock";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Selector de artículo con búsqueda contra el backend. A diferencia de
// ProveedorCombobox (que trae la lista entera y filtra en memoria), acá la
// tabla puede tener miles de artículos, así que se busca server-side.
//
// Lo comparten el filtro del feed de movimientos (con la opción "Todos") y el
// diálogo de registrar movimiento abierto sin fila de origen (sin esa opción,
// porque ahí elegir un artículo es obligatorio).
export default function ArticuloPicker({
  elegido,
  onChange,
  incluirOpcionTodos = false,
  placeholder = "Elegir artículo…",
  className,
}: {
  elegido: ArticuloStock | null;
  onChange: (articulo: ArticuloStock | null) => void;
  incluirOpcionTodos?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [resultados, setResultados] = useState<ArticuloStock[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ pageSize: "20" });
    if (debounced.trim()) params.set("search", debounced.trim());
    apiFetch<{ items: ArticuloStock[] }>(`/api/stock?${params.toString()}`)
      .then((json) => {
        if (active) setResultados(json.items);
      })
      .catch(() => {
        // Sin resultados el picker queda vacío; el resto de la pantalla sigue
        // funcionando.
      });
    return () => {
      active = false;
    };
  }, [debounced]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-64 justify-between font-normal", className)}
          />
        }
      >
        <span className={cn("truncate", elegido ? "" : "text-muted-foreground")}>
          {elegido ? `${elegido.marca} ${elegido.codigo}` : placeholder}
        </span>
        <ChevronsUpDownIcon className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* shouldFilter={false}: los resultados ya vienen filtrados por el
            backend; si cmdk los volviera a filtrar contra el value (el id),
            escondería coincidencias válidas. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar artículo…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {incluirOpcionTodos && (
                <CommandItem
                  value="__todos__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn("size-3.5", elegido ? "opacity-0" : "opacity-100")} />
                  Todos los artículos
                </CommandItem>
              )}
              {resultados.map((a) => (
                <CommandItem
                  key={a.id}
                  value={String(a.id)}
                  onSelect={() => {
                    onChange(a);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn("size-3.5", elegido?.id === a.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">
                    {a.marca} <span className="font-mono text-xs">{a.codigo}</span>
                    <span className="block text-xs text-muted-foreground">{a.descripcion}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
