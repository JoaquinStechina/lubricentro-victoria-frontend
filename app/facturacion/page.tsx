"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeftIcon, PlusIcon, XIcon } from "lucide-react";
import EstadoArcaBanner from "@/app/components/facturacion/EstadoArcaBanner";
import FacturacionNav from "@/app/components/facturacion/FacturacionNav";
import TablePaginationBar from "@/app/components/TablePaginationBar";
import ThemeToggle from "@/app/components/ThemeToggle";
import {
  esAmbienteDePrueba,
  etiquetaAmbiente,
  etiquetaEstado,
  etiquetaTipo,
  fetchFacturacion,
  formatearDocumento,
  formatearFechaIso,
  formatearMoneda,
  formatearNroComprobante,
  TIPOS_COMPROBANTE,
  varianteEstado,
  type Comprobante,
  type Paginado,
} from "@/app/lib/facturacion";
import { useTablaRecurso } from "@/app/lib/useTablaRecurso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [50, 100, 200] as const;

// Los filtros por columna de useTablaRecurso viajan como `f_<clave>`; el
// backend de comprobantes espera `estado` y `tipo` a secas (ver construir()).
const FILTROS_INICIALES = { estado: "", tipo: "" };

const ESTADOS_FILTRO = ["pendiente", "autorizado", "rechazado", "error"] as const;
const ITEMS_ESTADO: Record<string, string> = {
  todos: "Todos los estados",
  ...Object.fromEntries(ESTADOS_FILTRO.map((e) => [e, etiquetaEstado(e)])),
};
const ITEMS_TIPO: Record<string, string> = {
  todos: "Todos los tipos",
  ...Object.fromEntries(TIPOS_COMPROBANTE.map((t) => [String(t), etiquetaTipo(t)])),
};

// Respuesta etiquetada con la consulta que la originó: "cargando" se deriva y
// una respuesta vieja nunca pisa a una más nueva.
type Carga = { clave: string; data: Paginado<Comprobante> | null; error: string | null };

// `useSearchParams` obliga a un límite de Suspense para que el build pueda
// prerenderizar el resto de la página.
export default function ComprobantesPage() {
  return (
    <Suspense fallback={<p className="px-6 py-10 text-sm text-zinc-600 sm:px-10 dark:text-zinc-400">Cargando…</p>}>
      <ComprobantesView />
    </Suspense>
  );
}

// ?ventaId=N: el listado de ventas enlaza acá para ver los comprobantes de una
// venta. Solo se acepta un entero positivo; cualquier otra cosa se ignora en
// vez de mandarle basura al backend.
function leerVentaId(valor: string | null): string {
  return valor !== null && /^[1-9]\d{0,9}$/.test(valor) ? valor : "";
}

function ComprobantesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ventaId = leerVentaId(searchParams.get("ventaId"));

  const tabla = useTablaRecurso({ filtrosIniciales: FILTROS_INICIALES, pageSizeInicial: PAGE_SIZES[0] });
  const { buildParams, fetchKey: fetchKeyTabla, recargar } = tabla;
  const [carga, setCarga] = useState<Carga | null>(null);

  // Cambiar de venta es cambiar de consulta: vuelve a la página 1 (ajuste
  // durante el render, igual que hace useTablaRecurso con sus filtros).
  const [ventaPrev, setVentaPrev] = useState(ventaId);
  if (ventaId !== ventaPrev) {
    setVentaPrev(ventaId);
    tabla.setPage(1);
  }
  const fetchKey = `${fetchKeyTabla}|venta${ventaId}`;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    for (const [k, v] of buildParams(true)) params.set(k.startsWith("f_") ? k.slice(2) : k, v);
    if (ventaId) params.set("ventaId", ventaId);
    fetchFacturacion<Paginado<Comprobante>>(`/api/facturacion/comprobantes?${params.toString()}`)
      .then((res) => {
        if (active) setCarga({ clave: fetchKey, data: res.data, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setCarga({
            clave: fetchKey,
            data: null,
            error: err instanceof Error ? err.message : "No se pudieron cargar los comprobantes.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [buildParams, fetchKey, ventaId]);

  const cargando = carga === null || carga.clave !== fetchKey;
  const data = carga?.data ?? null;

  const rangoResultados =
    !data || data.total === 0
      ? "0 resultados"
      : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} de ${data.total.toLocaleString("es-AR")}`;

  const hayFiltros = tabla.hayFiltrosActivos || ventaId !== "";
  const colSpan = 8;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-foreground dark:text-zinc-400"
            >
              <ArrowLeftIcon className="size-3.5" />
              Catálogo
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Comprobantes</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button nativeButton={false} render={<Link href="/ventas/nueva" />}>
              <PlusIcon />
              Nueva venta
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <FacturacionNav />
        <EstadoArcaBanner />

        <section className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
              <Label htmlFor="comprobantes-search" className="text-zinc-600 dark:text-zinc-400">
                Buscar por receptor, documento o número
              </Label>
              <Input
                id="comprobantes-search"
                type="text"
                value={tabla.search}
                onChange={(e) => tabla.setSearch(e.target.value)}
                placeholder="Ej: Pérez, 30-12345678-9, 12"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Estado</span>
              <Select
                items={ITEMS_ESTADO}
                value={tabla.columnFilters.estado || "todos"}
                onValueChange={(v) => tabla.setColumnFilter("estado", !v || v === "todos" ? "" : v)}
              >
                <SelectTrigger aria-label="Filtrar por estado" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEMS_ESTADO).map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor}>
                      {etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Tipo</span>
              <Select
                items={ITEMS_TIPO}
                value={tabla.columnFilters.tipo || "todos"}
                onValueChange={(v) => tabla.setColumnFilter("tipo", !v || v === "todos" ? "" : v)}
              >
                <SelectTrigger aria-label="Filtrar por tipo" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEMS_TIPO).map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor}>
                      {etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tabla.hayFiltrosActivos && (
              <Button variant="outline" onClick={tabla.limpiarFiltros}>
                Limpiar filtros
              </Button>
            )}
          </div>
          {ventaId && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Filtrando por:</span>
              <Badge variant="secondary" className="h-6 gap-1 pr-1 text-sm">
                Venta #{ventaId}
                <button
                  type="button"
                  aria-label="Quitar el filtro de venta"
                  title="Quitar el filtro de venta"
                  onClick={() => router.replace("/facturacion")}
                  className="inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            </div>
          )}
        </section>

        <TablePaginationBar
          loading={cargando}
          data={data}
          rangoResultados={rangoResultados}
          pageSizeOptions={PAGE_SIZES}
          onPageChange={tabla.setPage}
          onPageSizeChange={tabla.setPageSize}
          className="mb-2"
        />

        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <Table>
            <TableHeader>
              <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Receptor</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>CAE</TableHead>
                <TableHead aria-label="Acciones" className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando && (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!cargando && carga?.error && (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-8 text-center whitespace-normal">
                    <p role="alert" className="mb-3 text-sm text-red-700 dark:text-red-400">
                      {carga.error}
                    </p>
                    <Button variant="outline" size="sm" onClick={recargar}>
                      Reintentar
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {!cargando && data && data.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className="py-8 text-center whitespace-normal text-zinc-500 dark:text-zinc-400"
                  >
                    {hayFiltros
                      ? "Ningún comprobante coincide con los filtros."
                      : "Todavía no hay comprobantes. Se crean al facturar una venta."}
                  </TableCell>
                </TableRow>
              )}
              {!cargando &&
                data?.items.map((c) => {
                  const pendiente = c.estado === "pendiente";
                  return (
                    <TableRow
                      key={c.id}
                      className={cn(
                        pendiente &&
                          "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
                      )}
                    >
                      <TableCell className="whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                        {formatearFechaIso(c.fechaEmision)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                        <span>{etiquetaTipo(c.tipo)}</span>
                        {esAmbienteDePrueba(c.ambiente) && (
                          <Badge
                            variant="outline"
                            title={`Ambiente ${etiquetaAmbiente(c.ambiente)}: sin validez fiscal`}
                            className="ml-2 border-sky-300 text-sky-800 dark:border-sky-800 dark:text-sky-300"
                          >
                            prueba
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                        {formatearNroComprobante(c.ptoVta, c.nro)}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{c.receptorNombre}</div>
                        <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {c.receptorDocTipo === 99
                            ? "Sin identificar"
                            : formatearDocumento(c.receptorDocTipo, c.receptorDocNro)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatearMoneda(c.impTotal)}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <Badge variant={varianteEstado(c.estado)}>{etiquetaEstado(c.estado)}</Badge>
                        {pendiente && (
                          <p className="mt-1 text-xs font-medium text-amber-900 dark:text-amber-200">
                            Sin confirmar con ARCA
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                        {c.cae ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Ver el comprobante ${c.id}`}
                            nativeButton={false}
                            render={<Link href={`/facturacion/${c.id}`} />}
                          >
                            Ver
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        <TablePaginationBar
          loading={cargando}
          data={data}
          rangoResultados={rangoResultados}
          pageSizeOptions={PAGE_SIZES}
          onPageChange={tabla.setPage}
          onPageSizeChange={tabla.setPageSize}
          className="mt-2"
        />
      </main>
    </div>
  );
}
