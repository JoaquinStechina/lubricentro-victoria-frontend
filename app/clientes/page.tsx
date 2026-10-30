"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import ClienteDialog from "@/app/components/facturacion/ClienteDialog";
import EstadoArcaBanner from "@/app/components/facturacion/EstadoArcaBanner";
import FacturacionNav from "@/app/components/facturacion/FacturacionNav";
import TablePaginationBar from "@/app/components/TablePaginationBar";
import ThemeToggle from "@/app/components/ThemeToggle";
import {
  ErrorApi,
  condicionIvaPorId,
  fetchFacturacion,
  formatearDocumento,
  jsonInit,
  type Cliente,
  type Paginado,
} from "@/app/lib/facturacion";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZES = [50, 100, 200] as const;

// Clientes no tiene filtros por columna: useTablaRecurso se usa solo por la
// búsqueda con debounce, la paginación y la papelera. La constante vive fuera
// del componente para que su identidad sea estable entre renders.
const SIN_FILTROS: Record<string, string> = {};

// Respuesta de la lista tagueada con la consulta que la originó (`clave`): así
// "cargando" se deriva (clave vigente !== clave de la respuesta) y una
// respuesta vieja nunca pisa a una más nueva ni queda mostrándose de más.
type Carga = { clave: string; data: Paginado<Cliente> | null; error: string | null };

export default function ClientesPage() {
  const tabla = useTablaRecurso({ filtrosIniciales: SIN_FILTROS, pageSizeInicial: PAGE_SIZES[0] });
  const { buildParams, fetchKey, recargar } = tabla;
  const [carga, setCarga] = useState<Carga | null>(null);
  // El diálogo de edición se queda con el último cliente mientras se cierra
  // (`editando` no se limpia al cerrar), para que no cambie a "Nuevo cliente"
  // durante la animación de salida.
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [aEliminar, setAEliminar] = useState<Cliente | null>(null);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<number | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFacturacion<Paginado<Cliente>>(`/api/clientes?${buildParams(true).toString()}`)
      .then((res) => {
        if (active) setCarga({ clave: fetchKey, data: res.data, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setCarga({
            clave: fetchKey,
            data: null,
            error: err instanceof Error ? err.message : "No se pudieron cargar los clientes.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [buildParams, fetchKey]);

  const cargando = carga === null || carga.clave !== fetchKey;
  const data = carga?.data ?? null;

  // Si se elimina o restaura la última fila de la última página, esa página
  // deja de existir: se vuelve a la última que queda (ajuste durante el render,
  // no en un efecto).
  if (!cargando && data && data.total > 0 && data.items.length === 0 && data.page > data.totalPages) {
    tabla.setPage(data.totalPages);
  }

  const rangoResultados =
    !data || data.total === 0
      ? "0 resultados"
      : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} de ${data.total.toLocaleString("es-AR")}`;

  async function restaurar(cliente: Cliente) {
    setErrorAccion(null);
    setRestaurandoId(cliente.id);
    try {
      await fetchFacturacion("/api/clientes/restaurar", jsonInit({ ids: [cliente.id] }, "POST"));
      recargar();
    } catch (err) {
      setErrorAccion(err instanceof ErrorApi ? err.error : "No se pudo restaurar el cliente.");
    } finally {
      setRestaurandoId(null);
    }
  }

  const colSpan = 6;
  const mensajeVacio = tabla.verEliminados
    ? tabla.debouncedSearch
      ? "Ningún cliente eliminado coincide con la búsqueda."
      : "No hay clientes eliminados."
    : tabla.debouncedSearch
      ? "Ningún cliente coincide con la búsqueda."
      : "Todavía no hay clientes cargados.";

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
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Clientes</h1>
          </div>
          <ThemeToggle />
        </header>

        <FacturacionNav />
        <EstadoArcaBanner />

        <section className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-1 text-sm">
              <Label htmlFor="clientes-search" className="text-zinc-600 dark:text-zinc-400">
                Buscar por nombre o documento
              </Label>
              <Input
                id="clientes-search"
                type="text"
                value={tabla.search}
                onChange={(e) => tabla.setSearch(e.target.value)}
                placeholder="Ej: Pérez, 30-12345678-9, 27123456"
                autoComplete="off"
              />
            </div>
            {tabla.search && (
              <Button variant="outline" onClick={tabla.limpiarFiltros}>
                Limpiar búsqueda
              </Button>
            )}
            <ClienteDialog
              cliente={null}
              onGuardado={recargar}
              trigger={
                <Button>
                  <PlusIcon />
                  Nuevo cliente
                </Button>
              }
            />
          </div>
          <div className="flex items-center gap-5 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <Switch checked={tabla.verEliminados} onCheckedChange={tabla.setVerEliminados} />
              <span className="text-zinc-700 dark:text-zinc-300">Ver papelera (clientes eliminados)</span>
            </label>
          </div>
        </section>

        {errorAccion && (
          <p
            role="alert"
            className="mb-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          >
            {errorAccion}
          </p>
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
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Condición IVA</TableHead>
                <TableHead>Domicilio</TableHead>
                <TableHead>Email</TableHead>
                <TableHead aria-label="Acciones" className="w-32" />
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
                    {mensajeVacio}
                  </TableCell>
                </TableRow>
              )}
              {!cargando &&
                data?.items.map((c) => {
                  const condicion = condicionIvaPorId(c.condicionIvaId);
                  return (
                    <TableRow key={c.id} className={c.eliminado ? "opacity-60" : undefined}>
                      <TableCell className="whitespace-normal font-medium text-zinc-900 dark:text-zinc-100">
                        {c.nombre}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                        {formatearDocumento(c.tipoDoc, c.nroDoc)}
                      </TableCell>
                      <TableCell className="whitespace-normal text-zinc-700 dark:text-zinc-300">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {condicion?.nombre ?? `Condición ${c.condicionIvaId}`}
                          {condicion && (
                            <Badge variant="outline" title={`Se le emite Factura ${condicion.clase}`}>
                              {condicion.clase}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal text-zinc-700 dark:text-zinc-300">
                        {c.domicilio ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-normal text-zinc-700 dark:text-zinc-300">
                        {c.email ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                      </TableCell>
                      <TableCell>
                        {c.eliminado ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restaurandoId === c.id}
                            onClick={() => restaurar(c)}
                          >
                            {restaurandoId === c.id ? "Restaurando…" : "Restaurar"}
                          </Button>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar a ${c.nombre}`}
                              title="Editar"
                              onClick={() => {
                                setEditando(c);
                                setEditOpen(true);
                              }}
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Eliminar a ${c.nombre}`}
                              title="Eliminar"
                              onClick={() => {
                                setErrorAccion(null);
                                setAEliminar(c);
                                setEliminarOpen(true);
                              }}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        )}
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

        <ClienteDialog cliente={editando} open={editOpen} onOpenChange={setEditOpen} onGuardado={recargar} />
        <EliminarClienteDialog
          cliente={aEliminar}
          open={eliminarOpen}
          onOpenChange={setEliminarOpen}
          onEliminado={recargar}
        />
      </main>
    </div>
  );
}

// Borrado lógico de un cliente. Las ventas y los comprobantes siguen
// apuntando a él, por eso no se borra de verdad y se puede restaurar desde la
// papelera.
function EliminarClienteDialog({
  cliente,
  open,
  onOpenChange,
  onEliminado,
}: {
  cliente: Cliente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEliminado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  async function confirmar() {
    if (!cliente) return;
    setError(null);
    setEliminando(true);
    try {
      await fetchFacturacion("/api/clientes/eliminar", jsonInit({ ids: [cliente.id] }, "POST"));
      onEliminado();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.error : "No se pudo eliminar el cliente.");
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
          <DialogTitle>¿Eliminar a {cliente?.nombre}?</DialogTitle>
          <DialogDescription>
            Es un borrado lógico: el cliente deja de aparecer en el listado y en el buscador, pero sus ventas y
            comprobantes no se tocan y se puede restaurar desde la papelera.
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
