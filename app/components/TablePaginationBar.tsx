"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PaginationData = { total: number; page: number; pageSize: number; totalPages: number };

type TablePaginationBarProps = {
  loading: boolean;
  data: PaginationData | null;
  rangoResultados: string;
  pageSizeOptions: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
};

// Mismo bloque arriba y abajo de la tabla (ver OfertasView/CatalogoView):
// ambas instancias leen y escriben el mismo estado del padre, así que
// quedan sincronizadas solas.
export default function TablePaginationBar({
  loading,
  data,
  rangoResultados,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationBarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400",
        className
      )}
    >
      <span>{loading ? "Cargando…" : rangoResultados}</span>
      <div className="flex items-center gap-3">
        {data && data.total > 0 && (
          <label className="flex items-center gap-1.5">
            <span className="text-xs">Filas por página</span>
            <Select
              items={Object.fromEntries(pageSizeOptions.map((n) => [String(n), String(n)]))}
              value={String(data.pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {data && data.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, data.page - 1))}
              disabled={data.page <= 1}
            >
              Anterior
            </Button>
            <span>
              Página {data.page} de {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(data.totalPages, data.page + 1))}
              disabled={data.page >= data.totalPages}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
