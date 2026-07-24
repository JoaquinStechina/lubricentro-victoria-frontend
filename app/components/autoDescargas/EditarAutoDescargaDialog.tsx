"use client";

import { useState, type FormEvent } from "react";
import { PencilIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import type { AutoDescargaMarca } from "@/app/lib/autoDescargas";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function EditarAutoDescargaDialog({
  fila,
  onUpdated,
}: {
  fila: AutoDescargaMarca;
  onUpdated: (fila: AutoDescargaMarca) => void;
}) {
  const [open, setOpen] = useState(false);
  const [marca, setMarca] = useState(fila.marca);
  const [porcentajeGanancia, setPorcentajeGanancia] = useState(
    fila.porcentajeGanancia != null ? String(fila.porcentajeGanancia) : ""
  );
  const [activo, setActivo] = useState(fila.activo);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const actualizada = await apiFetch<AutoDescargaMarca>(
        `/api/auto-descargas/${fila.id}`,
        apiJsonInit(
          {
            marca: marca.trim(),
            porcentajeGanancia: porcentajeGanancia.trim() === "" ? null : Number(porcentajeGanancia),
            activo,
          },
          "PATCH"
        )
      );
      onUpdated(actualizada);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la marca");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Editar marca</DialogTitle>
            <DialogDescription>{fila.proveedor.nombre}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`editar-marca-${fila.id}`}>Marca</Label>
            <Input
              id={`editar-marca-${fila.id}`}
              required
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`editar-porcentaje-${fila.id}`}>% de ganancia</Label>
            <Input
              id={`editar-porcentaje-${fila.id}`}
              type="number"
              inputMode="decimal"
              value={porcentajeGanancia}
              onChange={(e) => setPorcentajeGanancia(e.target.value)}
            />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <Switch checked={activo} onCheckedChange={setActivo} />
            Activo
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
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
