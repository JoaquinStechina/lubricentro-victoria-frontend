"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { ImageIcon, XIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import {
  PRODUCTO_FIELD_LABELS,
  PRODUCTO_NUMERIC_FIELDS,
  PRODUCTO_SINGLE_EDIT_FIELDS,
  type Producto,
} from "@/app/lib/productos";
import { useCalculoPrecios } from "@/app/components/catalogo/useCalculoPrecios";
import ProveedorCombobox from "@/app/components/ProveedorCombobox";
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

function emptyFormValues(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const campo of PRODUCTO_SINGLE_EDIT_FIELDS) values[campo] = "";
  return values;
}

// Alta manual de un producto suelto, en paralelo al pipeline de carga masiva
// de archivos (/cargas) — ver POST /api/productos en el backend.
export default function NuevoProductoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (producto: Producto) => void;
}) {
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [values, setValues] = useState(emptyFormValues);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    porcentajeGanancia,
    setPorcentajeGanancia,
    handleFieldChange,
    reset: resetCalculo,
  } = useCalculoPrecios(values, setValues);

  useEffect(() => {
    return () => {
      if (imagenPreview) URL.revokeObjectURL(imagenPreview);
    };
  }, [imagenPreview]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setProveedorNombre("");
      setValues(emptyFormValues());
      setImagenFile(null);
      setImagenPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
    }
    resetCalculo();
    onOpenChange(next);
  }

  function handleImagenChange(f: File | null) {
    setImagenFile(f);
    setImagenPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proveedorNombre.trim()) {
      setError("Elegí o escribí un proveedor.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = { proveedorNombre: proveedorNombre.trim() };
      for (const campo of PRODUCTO_SINGLE_EDIT_FIELDS) {
        const raw = values[campo].trim();
        if (PRODUCTO_NUMERIC_FIELDS.has(campo)) {
          body[campo] = raw === "" ? null : Number(raw);
        } else {
          body[campo] = raw === "" ? null : raw;
        }
      }
      let producto = await apiFetch<Producto>("/api/productos", apiJsonInit(body, "POST"));
      if (imagenFile) {
        const formData = new FormData();
        formData.append("imagen", imagenFile);
        producto = await apiFetch<Producto>(`/api/productos/${producto.id}/imagen`, {
          method: "POST",
          body: formData,
        });
      }
      onCreated(producto);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el producto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>Alta manual, sin pasar por una carga de archivo.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>Proveedor</Label>
            <ProveedorCombobox value={proveedorNombre} onChange={setProveedorNombre} className="w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {PRODUCTO_SINGLE_EDIT_FIELDS.map((campo) => (
              <Fragment key={campo}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`nuevo-producto-${campo}`}>{PRODUCTO_FIELD_LABELS[campo]}</Label>
                  <Input
                    id={`nuevo-producto-${campo}`}
                    value={values[campo]}
                    onChange={(e) => handleFieldChange(campo, e.target.value)}
                    inputMode={PRODUCTO_NUMERIC_FIELDS.has(campo) ? "decimal" : "text"}
                  />
                </div>
                {campo === "precioSugerido" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nuevo-producto-pct-ganancia">% de ganancia</Label>
                    <Input
                      id="nuevo-producto-pct-ganancia"
                      value={porcentajeGanancia}
                      onChange={(e) => setPorcentajeGanancia(e.target.value)}
                      inputMode="decimal"
                      placeholder="Solo para calcular el Precio Sugerido"
                    />
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Foto (opcional)</Label>
            <div className="flex items-center gap-3">
              {imagenPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagenPreview} alt="" className="size-14 rounded object-cover" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                  <ImageIcon className="size-5" />
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Elegir imagen
              </Button>
              {imagenFile && (
                <Button type="button" variant="ghost" size="sm" onClick={() => handleImagenChange(null)}>
                  <XIcon className="size-3.5" />
                  Quitar
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleImagenChange(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
