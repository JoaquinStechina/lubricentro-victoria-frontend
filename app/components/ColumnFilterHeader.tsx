"use client";

import { useState } from "react";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SELECT_ALL_VALUE = "__all__";

type ColumnFilterHeaderProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  align?: "left" | "right";
  // Si viene seteado, el filtro se muestra como un <select> de opciones fijas
  // en vez de un texto libre (ej. "Vigencia": hasta agotar stock vs. con
  // fecha de vencimiento, algo que no se puede resolver con "contains").
  options?: { value: string; label: string }[];
  // Filtro adicional por fecha exacta (input type="date") debajo del
  // principal — ej. "Válida hasta": además de la categoría, buscar las que
  // vencen un día puntual.
  dateValue?: string;
  onDateChange?: (value: string) => void;
};

export default function ColumnFilterHeader({
  label,
  value,
  onChange,
  align = "left",
  options,
  dateValue,
  onDateChange,
}: ColumnFilterHeaderProps) {
  const [open, setOpen] = useState(false);
  const active = value.trim().length > 0 || (dateValue ?? "").trim().length > 0;

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <div
        className={cn(
          "flex items-center gap-1",
          align === "right" && "flex-row-reverse"
        )}
      >
        <span>{label}</span>
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
            className="w-56 p-2"
            align={align === "right" ? "end" : "start"}
          >
            {options ? (
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
            {active && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  onDateChange?.("");
                }}
                className="mt-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar filtro
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </TableHead>
  );
}
