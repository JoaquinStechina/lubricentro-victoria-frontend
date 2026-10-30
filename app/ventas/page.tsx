"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, Loader2Icon, PlusIcon, ReceiptIcon, Trash2Icon } from "lucide-react";
import EstadoArcaBanner from "@/app/components/facturacion/EstadoArcaBanner";
import FacturacionNav from "@/app/components/facturacion/FacturacionNav";
import ResultadoEmisionPanel from "@/app/components/facturacion/ResultadoEmisionPanel";
import TablePaginationBar from "@/app/components/TablePaginationBar";
import ThemeToggle from "@/app/components/ThemeToggle";
import {
  ErrorApi,
  etiquetaEstadoFactura,
  fetchFacturacion,
  formatearFechaIso,
  formatearMoneda,
  jsonInit,
  type EstadoFactura,
  type Paginado,
  type Venta,
} from "@/app/lib/facturacion";
import { useEmitirFactura } from "@/app/lib/useEmitirFactura";
import { useTablaRecurso } from "@/app/lib/useTablaRecurso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZES = [50, 100, 200] as const;

// Ventas no tiene búsqueda ni filtros: useTablaRecurso aporta la paginación y
// el refetch. La constante vive fuera para que su identidad sea estable.
const SIN_FILTROS: Record<string, string> = {};

// Respuesta etiquetada con la consulta que la originó: "cargando" se deriva y
// una respuesta vieja nunca pisa a una más nueva.
type Carga = { clave: string; data: Paginado<Venta> | null; error: string | null };

// "Pendiente" tiene que destacar (hay que reconciliar con ARCA): ámbar, que no
// existe como variante de Badge. Facturada va en esmeralda; el resto, neutro.
const ESTILO_ESTADO: Record<EstadoFactura, string> = {
  sin_facturar: "",
  pendiente:
    "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  facturada:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  con_notas: "",
};

function BadgeEstadoFactura({ estado }: { estado: EstadoFactura }) {
  return (
    <Badge
      variant={estado === "sin_facturar" || estado === "con_notas" ? "outline" : "secondary"}
      className={ESTILO_ESTADO[estado]}
    >
      {etiquetaEstadoFactura(estado)}
    </Badge>
  );
}

export default function VentasPage() {
  const tabla = useTablaRecurso({ filtrosIniciales: SIN_FILTROS, pageSizeInicial: PAGE_SIZES[0] });
  const { buildParams, fetchKey, recargar } = tabla;
  const [carga, setCarga] = useState<Carga | null>(null);
  const [aEliminar, setAEliminar] = useState<Venta | null>(null);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [aFacturar, setAFacturar] = useState<Venta | null>(null);
  const [facturarOpen, setFacturarOpen] = useState(false);
  const { emitir, emitiendoId, resultado, limpiarResultado } = useEmitirFactura();

  useEffect(() => {
    let active = true;
    fetchFacturacion<Paginado<Venta>>(`/api/ventas?${buildParams(true).toString()}`)
      .then((res) => {
        if (active) setCarga({ clave: fetchKey, data: res.data, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setCarga({
            clave: fetchKey,
            data: null,
            error: err instanceof Error ? err.message : "No se pudieron cargar las ventas.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [buildParams, fetchKey]);

  const cargando = carga === null || carga.clave !== fetchKey;
  const data = carga?.data ?? null;

  // Si se elimina la última fila de la última página, esa página deja de
  // existir: se vuelve a la última que queda (ajuste durante el render).
  if (!cargando && data && data.total > 0 && data.items.length === 0 && data.page > data.totalPages) {
    tabla.setPage(data.totalPages);
  }

  const rangoResultados =
    !data || data.total === 0
      ? "0 resultados"
      : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} de ${data.total.toLocaleString("es-AR")}`;

  // Tras facturar (sea cual sea el resultado) la fila cambia de estado: se
  // refresca la lista. Si fue autorizada el hook ya está navegando al detalle.
  async function facturar(venta: Venta) {
    const r = await emitir(venta.id);
    if (r && r.tipo !== "autorizado") recargar();
  }

  const colSpan = 6;

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
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Ventas</h1>
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

        {emitiendoId !== null && !resultado && (
          <p
            role="status"
            className="mb-3 flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
          >
            <Loader2Icon className="size-4 animate-spin" />
            Facturando la venta #{emitiendoId}… no cierres ni recargues la página.
          </p>
        )}
        {resultado && (
          <div className="mb-3">
            <ResultadoEmisionPanel
              resultado={resultado}
              reintentando={emitiendoId !== null}
              onReintentar={() => {
                const v = data?.items.find((x) => x.id === resultado.ventaId);
                if (v) void facturar(v);
                else void emitir(resultado.ventaId).then((r) => r && r.tipo !== "autorizado" && recargar());
              }}
              onCerrar={resultado.tipo === "autorizado" ? undefined : limpiarResultado}
            />
          </div>
        )}

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
                <TableHead>Venta</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Facturación</TableHead>
                <TableHead aria-label="Acciones" className="w-64" />
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
                    Todavía no hay ventas cargadas.
                  </TableCell>
                </TableRow>
              )}
              {!cargando &&
                data?.items.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">#{v.id}</TableCell>
                    <TableCell className="whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {formatearFechaIso(v.fecha)}
                    </TableCell>
                    <TableCell className="whitespace-normal font-medium text-zinc-900 dark:text-zinc-100">
                      {v.cliente?.nombre ?? (
                        <span className="font-normal text-zinc-600 dark:text-zinc-400">Consumidor Final</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                      {v.impTotal === null ? (
                        <span title="No se pudo calcular el total de esta venta" className="text-zinc-400 dark:text-zinc-600">
                          —
                        </span>
                      ) : (
                        formatearMoneda(v.impTotal)
                      )}
                    </TableCell>
                    <TableCell>
                      <BadgeEstadoFactura estado={v.estadoFactura} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {v.estadoFactura === "sin_facturar" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={emitiendoId !== null}
                            onClick={() => {
                              setAFacturar(v);
                              setFacturarOpen(true);
                            }}
                          >
                            <ReceiptIcon />
                            {emitiendoId === v.id ? "Facturando…" : "Facturar"}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={<Link href={`/facturacion?ventaId=${v.id}`} />}
                          >
                            Ver comprobantes
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Eliminar la venta ${v.id}`}
                          title="Eliminar"
                          disabled={emitiendoId === v.id}
                          onClick={() => {
                            setAEliminar(v);
                            setEliminarOpen(true);
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

        <ConfirmarFacturarDialog
          venta={aFacturar}
          open={facturarOpen}
          onOpenChange={setFacturarOpen}
          onConfirmar={(v) => void facturar(v)}
        />
        <EliminarVentaDialog
          venta={aEliminar}
          open={eliminarOpen}
          onOpenChange={setEliminarOpen}
          onEliminada={recargar}
        />
      </main>
    </div>
  );
}

// Emitir una factura no se deshace (corregirla exige una nota de crédito):
// por eso pide confirmación. Confirmar es la "intención" de emitir; la clave de
// idempotencia la maneja useEmitirFactura.
function ConfirmarFacturarDialog({
  venta,
  open,
  onOpenChange,
  onConfirmar,
}: {
  venta: Venta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (venta: Venta) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Facturar la venta #{venta?.id}?</DialogTitle>
          <DialogDescription>
            Se emite el comprobante a {venta?.cliente?.nombre ?? "Consumidor Final"}
            {venta?.impTotal != null ? ` por ${formatearMoneda(venta.impTotal)}` : ""}. Una factura autorizada no se
            puede editar ni borrar: para corregirla hay que emitir una nota de crédito.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              if (venta) onConfirmar(venta);
            }}
          >
            Facturar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Borrado lógico. El backend responde 409 si la venta tiene un comprobante
// autorizado o pendiente: se muestra su mensaje tal cual. No hay papelera ni
// restauración de ventas (el backend no las tiene).
function EliminarVentaDialog({
  venta,
  open,
  onOpenChange,
  onEliminada,
}: {
  venta: Venta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEliminada: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function confirmar() {
    if (!venta) return;
    setError(null);
    setEliminando(true);
    try {
      await fetchFacturacion("/api/ventas/eliminar", jsonInit({ ids: [venta.id] }, "POST"));
      onEliminada();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.error : "No se pudo eliminar la venta.");
    } finally {
      setEliminando(false);
    }
  }

  function cambiar(siguiente: boolean) {
    if (!siguiente) setError(null);
    onOpenChange(siguiente);
  }

  return (
    <Dialog open={open} onOpenChange={cambiar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar la venta #{venta?.id}?</DialogTitle>
          <DialogDescription>
            La venta deja de aparecer en el listado. No se puede eliminar si tiene una factura autorizada o pendiente
            de confirmar con ARCA.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => cambiar(false)} disabled={eliminando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={eliminando}>
            {eliminando ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
