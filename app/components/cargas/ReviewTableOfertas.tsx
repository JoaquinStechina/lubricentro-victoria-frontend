"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import { applyMappingPreviewOfertas } from "@/app/lib/applyMappingPreviewOfertas";
import {
  CANONICAL_FIELDS_OFERTAS,
  OFERTA_FIELD_LABELS,
  type Advertencia,
  type OfertaField,
  type OfertaRowInput,
  type Carga,
  type OfertaColumnMapping,
  type OfertaMetadata,
} from "@/app/lib/cargas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NONE_VALUE = "__none__";
const PAGE_SIZE = 50;

const MAPPING_SELECT_ITEMS: Record<string, string> = {
  [NONE_VALUE]: "No mapear",
  ...OFERTA_FIELD_LABELS,
};

// Los campos "de todo el archivo" (ver docs/plan-ofertas.md, punto 2):
// auto-detectados por IA en metadataOferta, editables una sola vez acá
// arriba en vez de por fila.
const METADATA_FIELDS: {
  key: keyof OfertaMetadata;
  label: string;
  placeholder?: string;
  type?: string;
}[] = [
  { key: "marca", label: "Marca" },
  { key: "numero_oferta", label: "N° oferta" },
  { key: "fecha_oferta", label: "Fecha oferta", type: "date" },
  { key: "hora_oferta", label: "Hora oferta", type: "time" },
  {
    key: "fecha_hasta",
    label: "Válida hasta",
    placeholder: "vacío = hasta agotar stock",
    type: "date",
  },
];

type ReviewTableOfertasProps = {
  carga: Carga;
  onConfirmed: (carga: Carga) => void;
};

// Paralela a ReviewTable.tsx (mismo criterio de "funciones/componentes
// paralelos" del plan de ofertas: el shape de los datos y el paso extra de
// metadata de archivo no calzan bien en una sola tabla genérica).
export default function ReviewTableOfertas({ carga, onConfirmed }: ReviewTableOfertasProps) {
  const router = useRouter();
  const { headers, rows: rawRows } = carga.filasExtraidas ?? { headers: [], rows: [] };

  const [metadata, setMetadata] = useState<OfertaMetadata>(carga.metadataOferta ?? {});
  const [mapping, setMapping] = useState<OfertaColumnMapping>(
    (carga.mapeoSugerido as OfertaColumnMapping | null) ?? {}
  );
  const [rows, setRows] = useState<OfertaRowInput[]>(() =>
    applyMappingPreviewOfertas(headers, rawRows, mapping, metadata)
  );
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Etapa 5 (ver contexto.md): igual que ReviewTable.tsx, se piden una sola
  // vez al montar y no se recalculan si el usuario cambia el mapeo o la
  // metadata después.
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);
  useEffect(() => {
    let active = true;
    apiFetch<{ advertencias: Advertencia[] }>(`/api/uploads/${carga.id}/advertencias`)
      .then((res) => {
        if (active) setAdvertencias(res.advertencias);
      })
      .catch(() => {
        // No bloquea la revisión: si falla, simplemente no se muestran
        // advertencias para esta carga.
      });
    return () => {
      active = false;
    };
  }, [carga.id]);

  const advertenciasPorFila = useMemo(() => {
    const mapa = new Map<number, Advertencia[]>();
    for (const a of advertencias) {
      const lista = mapa.get(a.fila) ?? [];
      lista.push(a);
      mapa.set(a.fila, lista);
    }
    return mapa;
  }, [advertencias]);

  // Al cambiar el mapeo o la metadata de archivo, recalcula la vista previa
  // — pero preserva cualquier celda que el usuario ya haya corregido a mano
  // (dirtyRef), igual que ReviewTable.tsx.
  useEffect(() => {
    const preview = applyMappingPreviewOfertas(headers, rawRows, mapping, metadata);
    setRows((prev) =>
      preview.map((newRow, idx) => {
        const prevRow = prev[idx];
        if (!prevRow) return newRow;
        const merged: OfertaRowInput = { ...newRow };
        for (const field of CANONICAL_FIELDS_OFERTAS) {
          if (dirtyRef.current.has(`${idx}:${field}`)) {
            merged[field] = prevRow[field];
          }
        }
        return merged;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping, metadata]);

  function handleMappingChange(header: string, value: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (value === NONE_VALUE) delete next[header];
      else next[header] = value as OfertaField;
      return next;
    });
  }

  function handleMetadataChange(key: keyof OfertaMetadata, value: string) {
    setMetadata((prev) => ({ ...prev, [key]: value }));
  }

  function handleCellChange(rowIdx: number, field: OfertaField, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [field]: value };
      return next;
    });
    setDirty((prev) => new Set(prev).add(`${rowIdx}:${field}`));
  }

  function toggleExcluded(idx: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const filasFinales = rows.filter((_, idx) => !excluded.has(idx));
      const res = await apiFetch<{ carga: Carga; publicados: number }>(
        `/api/uploads/${carga.id}/confirmar`,
        apiJsonInit({ mapeo: mapping, filas: filasFinales })
      );
      setDialogOpen(false);
      onConfirmed(res.carga);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancelarCarga() {
    setCancelling(true);
    setCancelError(null);
    try {
      await apiFetch(`/api/uploads/${carga.id}`, { method: "DELETE" });
      setCancelDialogOpen(false);
      router.push("/cargas");
      router.refresh();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : String(err));
    } finally {
      setCancelling(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows
    .map((row, idx) => ({ row, idx }))
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const incluidas = rows.length - excluded.size;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Datos del archivo (aplican a toda la oferta)
        </h2>
        <div className="flex flex-wrap gap-3">
          {METADATA_FIELDS.map(({ key, label, placeholder, type }) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
              <Input
                type={type ?? "text"}
                value={metadata[key] ?? ""}
                onChange={(e) => handleMetadataChange(key, e.target.value)}
                className="h-8 w-40 text-sm"
                placeholder={placeholder ?? "—"}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Sugeridos por IA a partir del nombre de archivo y el encabezado — corregí lo que haga
          falta antes de confirmar. Solo se usan para las filas donde el dato no viene de una
          columna mapeada.
        </p>
        {carga.sinFechaLimite && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Se marcó como <strong>&quot;Hasta agotar stock&quot;</strong> al subir el archivo, por
            eso &quot;Válida hasta&quot; quedó vacío.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Mapeo de columnas
        </h2>
        <div className="flex flex-wrap gap-3">
          {headers.map((h) => (
            <div key={h} className="flex flex-col gap-1">
              <span className="max-w-40 truncate text-xs text-zinc-500 dark:text-zinc-400" title={h}>
                {h}
              </span>
              <Select
                items={MAPPING_SELECT_ITEMS}
                value={mapping[h] ?? NONE_VALUE}
                onValueChange={(value) => handleMappingChange(h, value as string)}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>No mapear</SelectItem>
                  {CANONICAL_FIELDS_OFERTAS.map((field) => (
                    <SelectItem key={field} value={field}>
                      {OFERTA_FIELD_LABELS[field]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          {rows.length.toLocaleString("es-AR")} filas
          {excluded.size > 0 && ` (${excluded.size} excluidas)`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <span>
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <Table className="min-w-[1400px]">
          <TableHeader>
            <TableRow className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <TableHead>Incluir</TableHead>
              {CANONICAL_FIELDS_OFERTAS.map((field) => (
                <TableHead key={field}>{OFERTA_FIELD_LABELS[field]}</TableHead>
              ))}
              <TableHead>Datos sin mapear</TableHead>
              <TableHead>Advertencias</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map(({ row, idx }) => {
              const isExpanded = expandedRow === idx;
              const hasRawData = row.raw_data && Object.keys(row.raw_data).length > 0;
              const isExcluded = excluded.has(idx);
              const advertenciasFila = advertenciasPorFila.get(idx) ?? [];
              return (
                <Fragment key={idx}>
                  <TableRow
                    className={
                      isExcluded
                        ? "opacity-40"
                        : advertenciasFila.length > 0
                          ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
                          : undefined
                    }
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => toggleExcluded(idx)}
                        aria-label={isExcluded ? "Incluir fila" : "Excluir fila"}
                      />
                    </TableCell>
                    {CANONICAL_FIELDS_OFERTAS.map((field) => (
                      <TableCell key={field}>
                        <Input
                          value={row[field] ?? ""}
                          onChange={(e) => handleCellChange(idx, field, e.target.value)}
                          disabled={isExcluded}
                          className="h-7 w-32 text-xs"
                          placeholder={
                            field === "desde_cantidad"
                              ? "vacío = 1"
                              : field === "descuento_pct"
                                ? "vacío = 0"
                                : field === "cantidad_disponible"
                                  ? "vacío = sin dato"
                                  : undefined
                          }
                          inputMode={
                            field === "precio_unitario" ||
                            field === "descuento_pct" ||
                            field === "desde_cantidad" ||
                            field === "numero_oferta" ||
                            field === "cantidad_disponible"
                              ? "decimal"
                              : "text"
                          }
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      {hasRawData ? (
                        <button
                          type="button"
                          onClick={() => setExpandedRow(isExpanded ? null : idx)}
                          className="text-xs text-primary hover:underline"
                        >
                          {isExpanded ? "Ocultar" : `Ver (${Object.keys(row.raw_data!).length})`}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {advertenciasFila.length > 0 ? (
                        <span
                          className="text-xs font-medium text-amber-700 dark:text-amber-400"
                          title={advertenciasFila.map((a) => a.mensaje).join("\n")}
                        >
                          ⚠ {advertenciasFila.length}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && hasRawData && (
                    <TableRow className="bg-zinc-50 hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-950">
                      <TableCell colSpan={CANONICAL_FIELDS_OFERTAS.length + 3} className="whitespace-normal py-3">
                        <pre className="overflow-x-auto rounded bg-white p-3 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                          {JSON.stringify(row.raw_data, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="lg" disabled={cancelling} />}>Confirmar carga</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Confirmar carga de {incluidas.toLocaleString("es-AR")} ofertas?</DialogTitle>
              <DialogDescription>
                {excluded.size > 0 && `${excluded.size} fila(s) excluida(s) no se van a guardar. `}
                Esta acción escribe las ofertas en la base de datos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={confirming}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={confirming}>
                {confirming ? "Guardando…" : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogTrigger render={<Button size="lg" variant="destructive" disabled={confirming} />}>
            Cancelar carga
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Cancelar esta carga?</DialogTitle>
              <DialogDescription>
                Se elimina la carga y el archivo subido, y se descartan los datos revisados en esta
                pantalla. Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            {cancelError && <p className="text-sm text-destructive">{cancelError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
                Volver
              </Button>
              <Button variant="destructive" onClick={handleCancelarCarga} disabled={cancelling}>
                {cancelling ? "Cancelando…" : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
