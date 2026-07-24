"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import type { AutoDescargaMarca } from "@/app/lib/autoDescargas";
import ProveedorCombobox from "@/app/components/ProveedorCombobox";
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

export default function NuevaAutoDescargaDialog({
  onCreated,
}: {
  onCreated: (fila: AutoDescargaMarca) => void;
}) {
  const [open, setOpen] = useState(false);
  const [proveedorNombre, setProveedorNombre] = useState("ABC");
  const [marca, setMarca] = useState("");
  const [porcentajeGanancia, setPorcentajeGanancia] = useState("");
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setProveedorNombre("ABC");
    setMarca("");
    setPorcentajeGanancia("");
    setActivo(true);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proveedorNombre.trim() || !marca.trim()) {
      setError("Elegí un proveedor y escribí la marca.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const fila = await apiFetch<AutoDescargaMarca>(
        "/api/auto-descargas",
        apiJsonInit({
          proveedorNombre: proveedorNombre.trim(),
          marca: marca.trim(),
          porcentajeGanancia: porcentajeGanancia.trim() === "" ? null : Number(porcentajeGanancia),
          activo,
        })
      );
      onCreated(fila);
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la marca");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) resetForm();
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Nueva marca
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nueva marca para auto-descarga</DialogTitle>
            <DialogDescription>
              El texto de &quot;Marca&quot; debe coincidir exacto con el texto de la columna Marca
              en el portal del proveedor.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>Proveedor</Label>
            <ProveedorCombobox value={proveedorNombre} onChange={setProveedorNombre} className="w-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nueva-marca">Marca</Label>
            <Input id="nueva-marca" required value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nueva-porcentaje">% de ganancia (opcional)</Label>
            <Input
              id="nueva-porcentaje"
              type="number"
              inputMode="decimal"
              value={porcentajeGanancia}
              onChange={(e) => setPorcentajeGanancia(e.target.value)}
              placeholder="Ej: 40"
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
              {loading ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
