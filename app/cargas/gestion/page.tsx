"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, PackageIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import ThemeToggle from "@/app/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Pantalla mínima sobre los datos ya publicados desde /cargas (ProductoPrecio
// vigente / Oferta activa) — complementa a "/" (que ya lee del backend real,
// ver ../../../../contexto.md), con foco en cerrar/reactivar ofertas. Sin
// buscador ni filtros por columna a propósito: es solo para ver el estado
// actual, no un reemplazo del catálogo público.

type ProductoVigente = {
  id: number;
  proveedor: { id: number; nombre: string } | null;
  marca: string | null;
  skuProveedor: string | null;
  descripcion: string | null;
  precioNeto: number | null;
};

type OfertaActiva = {
  id: number;
  proveedorId: number;
  proveedor: { id: number; nombre: string } | null;
  marca: string;
  numeroOferta: number;
  skuProveedor: string;
  descripcion: string;
  desdeCantidad: number;
  descuentoPct: number;
  precioUnitario: number;
  fechaHasta: string | null;
  cantidadDisponible: number | null;
  activa: boolean;
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

export default function GestionPage() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-4">
            <Link
              href="/cargas"
              className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowLeftIcon className="size-3.5" />
              Cargas
            </Link>
            <Link href="/stock">
              <Button variant="outline">
                <PackageIcon />
                Stock
              </Button>
            </Link>
            <ThemeToggle />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Catálogo y ofertas
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Precio vigente por SKU y ofertas activas, ya publicados desde una carga confirmada.
          </p>
        </header>

        <Tabs defaultValue="catalogo">
          <TabsList>
            <TabsTrigger value="catalogo">Catálogo vigente</TabsTrigger>
            <TabsTrigger value="ofertas">Ofertas activas</TabsTrigger>
          </TabsList>
          <TabsContent value="catalogo">
            <CatalogoVigente />
          </TabsContent>
          <TabsContent value="ofertas">
            <OfertasActivas />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CatalogoVigente() {
  const [data, setData] = useState<{ items: ProductoVigente[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{ items: ProductoVigente[]; total: number }>("/api/productos?pageSize=100")
      .then((res) => {
        if (active) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <Table>
        <TableHeader>
          <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <TableHead>Proveedor</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Precio neto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                Cargando…
              </TableCell>
            </TableRow>
          )}
          {!loading && data?.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                Todavía no hay productos publicados.
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="text-zinc-700 dark:text-zinc-300">{p.proveedor?.nombre ?? "—"}</TableCell>
              <TableCell className="text-zinc-700 dark:text-zinc-300">{p.marca ?? "—"}</TableCell>
              <TableCell className="text-zinc-900 dark:text-zinc-100">{p.skuProveedor ?? "—"}</TableCell>
              <TableCell className="max-w-96 truncate text-zinc-700 dark:text-zinc-300">
                {p.descripcion ?? "—"}
              </TableCell>
              <TableCell className="text-zinc-900 dark:text-zinc-100">
                {p.precioNeto != null ? currencyFormatter.format(p.precioNeto) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data && (
        <p className="border-t border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {data.total.toLocaleString("es-AR")} productos vigentes
        </p>
      )}
    </div>
  );
}

function OfertasActivas() {
  const [ofertas, setOfertas] = useState<OfertaActiva[] | null>(null);
  const [incluirCerradas, setIncluirCerradas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load(incluir: boolean) {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "100" });
    if (incluir) params.set("incluirCerradas", "true");
    apiFetch<{ items: OfertaActiva[]; total: number }>(`/api/ofertas?${params.toString()}`)
      .then((res) => setOfertas(res.items))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(incluirCerradas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluirCerradas]);

  // Cierra/reactiva TODOS los tramos (desde_cantidad distintos) de este
  // sku_proveedor dentro de esta oferta a la vez — ver POST /api/ofertas/
  // cerrar en el backend. Por eso puede desaparecer más de una fila de la
  // lista al tocar un solo botón.
  async function cambiarEstado(o: OfertaActiva, activar: boolean) {
    setBusyId(o.id);
    try {
      await apiFetch(
        `/api/ofertas/${activar ? "reactivar" : "cerrar"}`,
        apiJsonInit({ proveedorId: o.proveedorId, numeroOferta: o.numeroOferta, skuProveedor: o.skuProveedor })
      );
      load(incluirCerradas);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={incluirCerradas}
          onChange={(e) => setIncluirCerradas(e.target.checked)}
        />
        Mostrar cerradas/vencidas
      </label>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <TableHead>Proveedor</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>N° oferta</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Desde cant.</TableHead>
              <TableHead>Descuento</TableHead>
              <TableHead>Precio unitario</TableHead>
              <TableHead>Cantidad disp.</TableHead>
              <TableHead>Válida hasta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && ofertas?.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No hay ofertas {incluirCerradas ? "" : "activas"}.
                </TableCell>
              </TableRow>
            )}
            {ofertas?.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-zinc-700 dark:text-zinc-300">{o.proveedor?.nombre ?? "—"}</TableCell>
                <TableCell className="text-zinc-700 dark:text-zinc-300">{o.marca}</TableCell>
                <TableCell className="text-zinc-700 dark:text-zinc-300">{o.numeroOferta}</TableCell>
                <TableCell className="text-zinc-900 dark:text-zinc-100">{o.skuProveedor}</TableCell>
                <TableCell className="text-zinc-700 dark:text-zinc-300">{o.desdeCantidad}</TableCell>
                <TableCell className="text-zinc-700 dark:text-zinc-300">{o.descuentoPct}%</TableCell>
                <TableCell className="text-zinc-900 dark:text-zinc-100">
                  {currencyFormatter.format(o.precioUnitario)}
                </TableCell>
                <TableCell className="text-zinc-700 dark:text-zinc-300">
                  {o.cantidadDisponible ?? "—"}
                </TableCell>
                <TableCell className="text-zinc-700 dark:text-zinc-300">
                  {o.fechaHasta ?? "hasta agotar stock"}
                </TableCell>
                <TableCell className="text-zinc-700 dark:text-zinc-300">
                  {o.activa ? "Activa" : "Cerrada"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === o.id}
                    onClick={() => cambiarEstado(o, !o.activa)}
                  >
                    {o.activa ? "Marcar agotada" : "Reactivar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
