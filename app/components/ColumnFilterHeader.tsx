"use client";

import { useState } from "react";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ColumnFilterHeaderProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  align?: "left" | "right";
};

export default function ColumnFilterHeader({
  label,
  value,
  onChange,
  align = "left",
}: ColumnFilterHeaderProps) {
  const [open, setOpen] = useState(false);
  const active = value.trim().length > 0;

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
            <Input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`Filtrar ${label.toLowerCase()}…`}
              className="h-8"
            />
            {active && (
              <button
                type="button"
                onClick={() => onChange("")}
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
