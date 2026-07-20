"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import {
  PRODUCTO_BULK_EDIT_FIELDS,
  PRODUCTO_FIELD_LABELS,
  PRODUCTO_NUMERIC_FIELDS,
  type ProductoBulkEditField,
} from "@/app/lib/productos";
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

export default function BulkEditarProductoDialog({
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
  const [field, setField] = useState<ProductoBulkEditField>(PRODUCTO_BULK_EDIT_FIELDS[0]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setField(PRODUCTO_BULK_EDIT_FIELDS[0]);
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
      await apiFetch<{ actualizados: number }>(
        "/api/productos/editar-lote",
        apiJsonInit(
          {
            ids,
            field,
            value: PRODUCTO_NUMERIC_FIELDS.has(field) ? Number(trimmed) : trimmed,
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
            <DialogTitle>Editar {ids.length} productos</DialogTitle>
            <DialogDescription>
              Se va a aplicar el mismo valor al campo elegido en las {ids.length} filas seleccionadas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-producto-campo">Campo</Label>
            <Select value={field} onValueChange={(v) => setField(v as ProductoBulkEditField)}>
              <SelectTrigger id="bulk-producto-campo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTO_BULK_EDIT_FIELDS.map((campo) => (
                  <SelectItem key={campo} value={campo}>
                    {PRODUCTO_FIELD_LABELS[campo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-producto-valor">Valor nuevo</Label>
            <Input
              id="bulk-producto-valor"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode={PRODUCTO_NUMERIC_FIELDS.has(field) ? "decimal" : "text"}
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
