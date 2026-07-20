"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import {
  OFERTA_FIELD_LABELS,
  OFERTA_NUMERIC_FIELDS,
  OFERTA_SINGLE_EDIT_FIELDS,
  type Oferta,
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

function initialFormValues(oferta: Oferta): Record<string, string> {
  const values: Record<string, string> = {};
  for (const campo of OFERTA_SINGLE_EDIT_FIELDS) {
    const valor = oferta[campo];
    values[campo] = valor === null || valor === undefined ? "" : String(valor);
  }
  return values;
}

export default function EditarOfertaDialog({
  oferta,
  open,
  onOpenChange,
  onUpdated,
}: {
  oferta: Oferta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (oferta: Oferta) => void;
}) {
  const [values, setValues] = useState(() => initialFormValues(oferta));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) setValues(initialFormValues(oferta));
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      for (const campo of OFERTA_SINGLE_EDIT_FIELDS) {
        const raw = values[campo].trim();
        if (campo === "fechaHasta") {
          body[campo] = raw === "" ? null : raw;
        } else if (OFERTA_NUMERIC_FIELDS.has(campo)) {
          body[campo] = Number(raw);
        } else {
          body[campo] = raw;
        }
      }
      const actualizada = await apiFetch<Oferta>(`/api/ofertas/${oferta.id}`, apiJsonInit(body, "PATCH"));
      onUpdated(actualizada);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la oferta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Editar oferta</DialogTitle>
            <DialogDescription>
              {oferta.proveedor?.nombre ?? "—"} · {oferta.skuProveedor}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            {OFERTA_SINGLE_EDIT_FIELDS.map((campo) => (
              <div key={campo} className="flex flex-col gap-1.5">
                <Label htmlFor={`editar-oferta-${campo}`}>{OFERTA_FIELD_LABELS[campo]}</Label>
                <Input
                  id={`editar-oferta-${campo}`}
                  required={campo !== "fechaHasta"}
                  placeholder={campo === "fechaHasta" ? "vacío = hasta agotar stock" : undefined}
                  value={values[campo]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [campo]: e.target.value }))}
                  inputMode={OFERTA_NUMERIC_FIELDS.has(campo) ? "decimal" : "text"}
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
