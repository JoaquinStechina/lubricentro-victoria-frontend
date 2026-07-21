"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import type { Proveedor } from "@/app/lib/cargas";
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

type ProveedorComboboxProps = {
  value: string;
  onChange: (nombre: string) => void;
  className?: string;
};

// Combobox de proveedor existente o "Crear <nombre tipeado>" — extraído de
// UploadForm.tsx (donde nació este patrón) para reusarlo también en los
// diálogos de alta manual de Producto/Oferta. Solo expone el nombre: el
// backend resuelve/crea el proveedor por nombre (upsert), mismo criterio que
// ya usa POST /api/uploads.
export default function ProveedorCombobox({ value, onChange, className }: ProveedorComboboxProps) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<Proveedor[]>("/api/proveedores")
      .then((data) => {
        if (active) setProveedores(data);
      })
      .catch(() => {
        // Sin lista de proveedores no se rompe el combobox: sigue aceptando
        // texto libre para crear uno nuevo.
      });
    return () => {
      active = false;
    };
  }, []);

  const filtrados = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(query.trim().toLowerCase())
  );
  const coincideExacto = proveedores.some(
    (p) => p.nombre.toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className={cn("justify-between font-normal", className)} />}
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {value || "Elegir o escribir proveedor…"}
        </span>
        <ChevronsUpDownIcon className="size-3.5 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar proveedor…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {filtrados.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.nombre}
                  onSelect={() => {
                    onChange(p.nombre);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn("size-3.5", value === p.nombre ? "opacity-100" : "opacity-0")} />
                  {p.nombre}
                </CommandItem>
              ))}
              {query.trim() && !coincideExacto && (
                <CommandItem
                  value={`crear-${query}`}
                  onSelect={() => {
                    onChange(query.trim());
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <PlusIcon className="size-3.5" />
                  Crear &ldquo;{query.trim()}&rdquo;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
