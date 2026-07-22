"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import {
  OFERTA_BULK_EDIT_FIELDS,
  OFERTA_FIELD_LABELS,
  OFERTA_NULLABLE_FIELDS,
  OFERTA_NUMERIC_FIELDS,
  type OfertaBulkEditField,
} from "@/app/lib/ofertas";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BulkEditarOfertaDialog({
  ids,
  open,
  onOpenChange,
  onUpdated,
}: {
  ids: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [field, setField] = useState<OfertaBulkEditField>(OFERTA_BULK_EDIT_FIELDS[0]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setField(OFERTA_BULK_EDIT_FIELDS[0]);
      setValue("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const trimmed = value.trim();
      const isFechaHasta = field === "fechaHasta";
      // cantidadDisponible es nulleable pero numérico: a diferencia de los
      // demás campos numéricos de este diálogo, vacío es null, no 0.
      const isNullableNumeric = field !== "fechaHasta" && OFERTA_NULLABLE_FIELDS.has(field);
      await apiFetch<{ actualizados: number }>(
        "/api/ofertas/editar-lote",
        apiJsonInit(
          {
            ids,
            field,
            value: isFechaHasta
              ? trimmed === ""
                ? null
                : trimmed
              : isNullableNumeric
                ? trimmed === ""
                  ? null
                  : Number(trimmed)
                : OFERTA_NUMERIC_FIELDS.has(field)
                  ? Number(trimmed)
                  : trimmed,
          },
          "POST"
        )
      );
      onUpdated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar el cambio en lote");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Editar {ids.length} ofertas</DialogTitle>
            <DialogDescription>
              Se va a aplicar el mismo valor al campo elegido en las {ids.length} filas seleccionadas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-oferta-campo">Campo</Label>
            <Select value={field} onValueChange={(v) => setField(v as OfertaBulkEditField)}>
              <SelectTrigger id="bulk-oferta-campo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFERTA_BULK_EDIT_FIELDS.map((campo) => (
                  <SelectItem key={campo} value={campo}>
                    {OFERTA_FIELD_LABELS[campo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-oferta-valor">Valor nuevo</Label>
            <Input
              id="bulk-oferta-valor"
              required={!OFERTA_NULLABLE_FIELDS.has(field)}
              placeholder={
                field === "fechaHasta"
                  ? "vacío = hasta agotar stock"
                  : field === "cantidadDisponible"
                    ? "vacío = sin dato"
                    : undefined
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode={OFERTA_NUMERIC_FIELDS.has(field) ? "decimal" : "text"}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Aplicando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
