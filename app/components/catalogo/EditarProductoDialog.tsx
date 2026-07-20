"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import {
  PRODUCTO_FIELD_LABELS,
  PRODUCTO_NUMERIC_FIELDS,
  PRODUCTO_SINGLE_EDIT_FIELDS,
  type Producto,
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

function initialFormValues(producto: Producto): Record<string, string> {
  const values: Record<string, string> = {};
  for (const campo of PRODUCTO_SINGLE_EDIT_FIELDS) {
    const valor = producto[campo];
    values[campo] = valor === null || valor === undefined ? "" : String(valor);
  }
  return values;
}

export default function EditarProductoDialog({
  producto,
  open,
  onOpenChange,
  onUpdated,
}: {
  producto: Producto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (producto: Producto) => void;
}) {
  const [values, setValues] = useState(() => initialFormValues(producto));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) setValues(initialFormValues(producto));
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      for (const campo of PRODUCTO_SINGLE_EDIT_FIELDS) {
        const raw = values[campo].trim();
        if (PRODUCTO_NUMERIC_FIELDS.has(campo)) {
          body[campo] = raw === "" ? null : Number(raw);
        } else {
          body[campo] = raw === "" ? null : raw;
        }
      }
      const actualizado = await apiFetch<Producto>(
        `/api/productos/${producto.id}`,
        apiJsonInit(body, "PATCH")
      );
      onUpdated(actualizado);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el producto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
            <DialogDescription>
              {producto.proveedor?.nombre ?? "—"} · {producto.skuInterno ?? producto.skuProveedor ?? "sin SKU"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            {PRODUCTO_SINGLE_EDIT_FIELDS.map((campo) => (
              <div key={campo} className="flex flex-col gap-1.5">
                <Label htmlFor={`editar-producto-${campo}`}>{PRODUCTO_FIELD_LABELS[campo]}</Label>
                <Input
                  id={`editar-producto-${campo}`}
                  value={values[campo]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [campo]: e.target.value }))}
                  inputMode={PRODUCTO_NUMERIC_FIELDS.has(campo) ? "decimal" : "text"}
                />
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
