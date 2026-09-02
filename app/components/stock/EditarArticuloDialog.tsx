"use client";

import { useState, type FormEvent } from "react";
import { PencilIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import type { ArticuloStock } from "@/app/lib/stock";
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

type FormValues = {
  marca: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  ubicacion: string;
  minimo: string;
};

function initialFormValues(articulo: ArticuloStock): FormValues {
  return {
    marca: articulo.marca,
    codigo: articulo.codigo,
    descripcion: articulo.descripcion,
    categoria: articulo.categoria ?? "",
    ubicacion: articulo.ubicacion ?? "",
    minimo: articulo.minimo === null ? "" : String(articulo.minimo),
  };
}

// Edición de los datos de un artículo de stock. La cantidad no se edita
// acá a propósito: PATCH /api/stock/:id rechaza `cantidad` con 400 (hay que
// registrar un movimiento, ver MovimientoDialog.tsx).
export default function EditarArticuloDialog({
  articulo,
  onEditado,
}: {
  articulo: ArticuloStock;
  onEditado: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(() => initialFormValues(articulo));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) setValues(initialFormValues(articulo));
    else setError(null);
    setOpen(next);
  }

  function setField(campo: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [campo]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.marca.trim() || !values.codigo.trim() || !values.descripcion.trim()) {
      setError("Marca, código y descripción son obligatorios.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiFetch<ArticuloStock>(
        `/api/stock/${articulo.id}`,
        apiJsonInit(
          {
            marca: values.marca.trim(),
            codigo: values.codigo.trim(),
            descripcion: values.descripcion.trim(),
            categoria: values.categoria.trim() || null,
            ubicacion: values.ubicacion.trim() || null,
            minimo: values.minimo === "" ? null : Number(values.minimo),
          },
          "PATCH"
        )
      );
      onEditado();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el artículo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Editar artículo</DialogTitle>
            <DialogDescription>
              {articulo.marca} · {articulo.codigo}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`editar-articulo-marca-${articulo.id}`}>Marca</Label>
              <Input
                id={`editar-articulo-marca-${articulo.id}`}
                required
                value={values.marca}
                onChange={(e) => setField("marca", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`editar-articulo-codigo-${articulo.id}`}>Código</Label>
              <Input
                id={`editar-articulo-codigo-${articulo.id}`}
                required
                value={values.codigo}
                onChange={(e) => setField("codigo", e.target.value)}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor={`editar-articulo-descripcion-${articulo.id}`}>Descripción</Label>
              <Input
                id={`editar-articulo-descripcion-${articulo.id}`}
                required
                value={values.descripcion}
                onChange={(e) => setField("descripcion", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`editar-articulo-categoria-${articulo.id}`}>Categoría</Label>
              <Input
                id={`editar-articulo-categoria-${articulo.id}`}
                value={values.categoria}
                onChange={(e) => setField("categoria", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`editar-articulo-ubicacion-${articulo.id}`}>Ubicación</Label>
              <Input
                id={`editar-articulo-ubicacion-${articulo.id}`}
                value={values.ubicacion}
                onChange={(e) => setField("ubicacion", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`editar-articulo-minimo-${articulo.id}`}>Mínimo</Label>
              <Input
                id={`editar-articulo-minimo-${articulo.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={values.minimo}
                onChange={(e) => setField("minimo", e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
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
