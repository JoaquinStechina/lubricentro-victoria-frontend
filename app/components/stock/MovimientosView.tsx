"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import {
  TIPO_MOVIMIENTO_LABELS,
  type ArticuloStock,
  type MovimientoStock,
  type TipoMovimiento,
} from "@/app/lib/stock";
import TablePaginationBar from "@/app/components/TablePaginationBar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ApiResponse = {
  items: MovimientoStock[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZES = [50, 100, 200] as const;

const TIPO_ITEMS: Record<string, string> = {
  "": "Todos",
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

// Formato del delta: el signo es la información principal de la fila, así que
// va explícito y con color, no solo el número.
function DeltaCell({ delta }: { delta: number }) {
  const clase =
    delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta < 0
        ? "text-destructive"
        : "text-muted-foreground";
  return <span className={cn("font-medium", clase)}>{delta > 0 ? `+${delta}` : String(delta)}</span>;
}

// Selector de artículo con búsqueda contra el backend. A diferencia de
// ProveedorCombobox (que trae la lista entera y filtra en memoria), acá la
// tabla puede tener miles de artículos, así que se busca server-side.
function ArticuloPicker({
  elegido,
  onChange,
}: {
  elegido: ArticuloStock | null;
  onChange: (articulo: ArticuloStock | null) => void;
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
        // Sin resultados el picker queda vacío; el resto de los filtros sigue
        // funcionando.
      });
    return () => {
      active = false;
    };
  }, [debounced]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="w-64 justify-between font-normal" />}
      >
        <span className={cn("truncate", elegido ? "" : "text-muted-foreground")}>
          {elegido ? `${elegido.marca} ${elegido.codigo}` : "Todos los artículos"}
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

// Feed global de movimientos de todos los artículos. No usa useTablaRecurso:
// no tiene filtros por columna, ni selección de filas, ni papelera.
export default function MovimientosView() {
  const [articulo, setArticulo] = useState<ArticuloStock | null>(null);
  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Cualquier cambio de filtro vuelve a página 1. Ajuste de estado durante el
  // render, no un efecto (ver useTablaRecurso, mismo criterio).
  const filtroKey = `${articulo?.id ?? ""}|${tipo}|${desde}|${hasta}|${pageSize}`;
  const [prevFiltroKey, setPrevFiltroKey] = useState(filtroKey);
  if (filtroKey !== prevFiltroKey) {
    setPrevFiltroKey(filtroKey);
    setPage(1);
  }

  const hayFiltrosActivos = Boolean(articulo || tipo || desde || hasta);

  function limpiarFiltros() {
    setArticulo(null);
    setTipo("");
    setDesde("");
    setHasta("");
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (articulo) params.set("articuloId", String(articulo.id));
    if (tipo) params.set("tipo", tipo);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    async function load() {
      setLoading(true);
      try {
        const json = await apiFetch<ApiResponse>(`/api/stock/movimientos?${params.toString()}`);
        if (active) setData(json);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [articulo, tipo, desde, hasta, page, pageSize]);

  const rangoResultados = data
    ? data.total === 0
      ? "Sin movimientos"
      : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} de ${data.total.toLocaleString("es-AR")}`
    : "";

  return (
    <>
      <section className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 text-sm">
            <Label className="text-zinc-600 dark:text-zinc-400">Artículo</Label>
            <ArticuloPicker elegido={articulo} onChange={setArticulo} />
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <Label className="text-zinc-600 dark:text-zinc-400">Tipo</Label>
            <Select
              items={TIPO_ITEMS}
              value={tipo}
              onValueChange={(v) => setTipo(v as TipoMovimiento | "")}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_ITEMS).map(([value, label]) => (
                  <SelectItem key={value || "todos"} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <Label htmlFor="mov-desde" className="text-zinc-600 dark:text-zinc-400">
              Desde
            </Label>
            <Input
              id="mov-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <Label htmlFor="mov-hasta" className="text-zinc-600 dark:text-zinc-400">
              Hasta
            </Label>
            <Input
              id="mov-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-40"
            />
          </div>

          {hayFiltrosActivos && (
            <Button variant="outline" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </section>

      <TablePaginationBar
        loading={loading}
        data={data}
        rangoResultados={rangoResultados}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        className="mb-2"
      />

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <TableHead className="w-40">Fecha</TableHead>
              <TableHead>Artículo</TableHead>
              <TableHead className="w-28">Tipo</TableHead>
              <TableHead className="w-24 text-right">Cambio</TableHead>
              <TableHead className="w-28 text-right">Resultante</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  {hayFiltrosActivos
                    ? "Ningún movimiento coincide con los filtros."
                    : "Todavía no se registraron movimientos."}
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                    {dateTimeFormatter.format(new Date(m.createdAt))}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {m.articulo?.marca} <span className="font-mono text-xs">{m.articulo?.codigo}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {m.articulo?.descripcion}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_MOVIMIENTO_LABELS[m.tipo]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaCell delta={m.delta} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        m.cantidadResultante < 0
                          ? "font-medium text-destructive"
                          : "text-zinc-900 dark:text-zinc-100"
                      }
                    >
                      {m.cantidadResultante}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-normal text-zinc-700 dark:text-zinc-300">
                    {m.motivo ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
