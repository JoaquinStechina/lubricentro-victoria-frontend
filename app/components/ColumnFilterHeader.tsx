"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CheckIcon, ChevronsUpDown, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SELECT_ALL_VALUE = "__all__";

export type SortDirection = "asc" | "desc" | null;

type ColumnFilterHeaderProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  align?: "left" | "right";
  // Si viene seteado, el filtro se muestra como un <select> de opciones fijas
  // en vez de un texto libre (ej. "Vigencia": hasta agotar stock vs. con
  // fecha de vencimiento, algo que no se puede resolver con "contains").
  options?: { value: string; label: string }[];
  // Como `options` pero con búsqueda (Command/cmdk) — para listas largas
  // como las +490 secciones del catálogo. Elegir setea `value` completo.
  searchOptions?: string[];
  // Filtro adicional por fecha exacta (input type="date") debajo del
  // principal — ej. "Válida hasta": además de la categoría, buscar las que
  // vencen un día puntual.
  dateValue?: string;
  onDateChange?: (value: string) => void;
  // Filtro por rango numérico (Mín/Máx) en vez del texto libre.
  rangeValue?: { min: string; max: string };
  onRangeChange?: (min: string, max: string) => void;
  // Orden por columna: si onSortToggle viene, el label es clickeable y
  // muestra la flecha según sortDirection. El ciclo asc→desc→null lo maneja
  // el padre (es global a la tabla, no por columna).
  sortDirection?: SortDirection;
  onSortToggle?: () => void;
};

export default function ColumnFilterHeader({
  label,
  value,
  onChange,
  align = "left",
  options,
  searchOptions,
  dateValue,
  onDateChange,
  rangeValue,
  onRangeChange,
  sortDirection = null,
  onSortToggle,
}: ColumnFilterHeaderProps) {
  const [open, setOpen] = useState(false);
  const active =
    value.trim().length > 0 ||
    (dateValue ?? "").trim().length > 0 ||
    (rangeValue ? rangeValue.min.trim().length > 0 || rangeValue.max.trim().length > 0 : false);

  function limpiar() {
    onChange("");
    onDateChange?.("");
    onRangeChange?.("", "");
  }

  return (
    // Ya no envuelve en <TableHead>: eso lo hace SortableResizableHead
    // (el <th> real, con ancho/drag/resize) para que este componente se
    // pueda anidar adentro sin duplicar el tag — ver CatalogoView/OfertasView.
    <div
      className={cn(
        // justify-end (no flex-row-reverse): empuja el grupo al borde
        // derecho de la celda sin invertir el orden de los ítems — el
        // ícono de filtro siempre queda a la derecha del de orden, tanto
        // en columnas alineadas a la izquierda como a la derecha.
        "flex min-w-0 items-center gap-1",
        align === "right" && "justify-end"
      )}
    >
      {onSortToggle ? (
        <button
          type="button"
          onClick={onSortToggle}
          className="flex min-w-0 items-center gap-0.5 hover:text-foreground"
          aria-label={`Ordenar por ${label.toLowerCase()}`}
        >
          <span className="truncate">{label}</span>
          {sortDirection === "asc" ? (
            <ArrowUp className="size-3 shrink-0 text-foreground" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="size-3 shrink-0 text-foreground" />
          ) : (
            <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground/50" />
          )}
        </button>
      ) : (
        <span className="truncate">{label}</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                "relative",
                active ? "text-foreground" : "text-muted-foreground/60"
              )}
            />
          }
        >
          <Filter className="size-3" />
          {active && (
            <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary" />
          )}
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-56", searchOptions ? "p-0" : "p-2")}
          align={align === "right" ? "end" : "start"}
        >
          {searchOptions ? (
            <Command>
              <CommandInput placeholder={`Buscar ${label.toLowerCase()}…`} />
              <CommandList>
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value={SELECT_ALL_VALUE}
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn("size-3.5", value === "" ? "opacity-100" : "opacity-0")}
                    />
                    Todas
                  </CommandItem>
                  {searchOptions.map((opcion) => (
                    <CommandItem
                      key={opcion}
                      value={opcion}
                      onSelect={() => {
                        onChange(opcion);
                        setOpen(false);
                      }}
                    >
                      <CheckIcon
                        className={cn("size-3.5", value === opcion ? "opacity-100" : "opacity-0")}
                      />
                      {opcion}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : options ? (
            <Select
              items={{
                [SELECT_ALL_VALUE]: "Todas",
                ...Object.fromEntries(options.map((o) => [o.value, o.label])),
              }}
              value={value || SELECT_ALL_VALUE}
              onValueChange={(v) =>
                onChange(v === SELECT_ALL_VALUE ? "" : (v as string))
              }
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_ALL_VALUE}>Todas</SelectItem>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : rangeValue && onRangeChange ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                type="number"
                value={rangeValue.min}
                onChange={(e) => onRangeChange(e.target.value, rangeValue.max)}
                placeholder="Mín"
                className="h-8"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                value={rangeValue.max}
                onChange={(e) => onRangeChange(rangeValue.min, e.target.value)}
                placeholder="Máx"
                className="h-8"
              />
            </div>
          ) : (
            <Input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`Filtrar ${label.toLowerCase()}…`}
              className="h-8"
            />
          )}
          {onDateChange && (
            <div className="mt-1.5 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Fecha exacta</span>
              <Input
                type="date"
                value={dateValue ?? ""}
                onChange={(e) => onDateChange(e.target.value)}
                className="h-8"
              />
            </div>
          )}
          {active && !searchOptions && (
            <button
              type="button"
              onClick={limpiar}
              className="mt-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar filtro
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
