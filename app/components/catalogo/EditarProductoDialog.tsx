"use client";

import { useRef, useState, type FormEvent } from "react";
import { ImageIcon } from "lucide-react";
import { apiFetch, apiJsonInit, imagenSrc } from "@/app/lib/api";
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
  onImagenUpdated,
}: {
  producto: Producto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (producto: Producto) => void;
  onImagenUpdated: (producto: Producto) => void;
}) {
  const [values, setValues] = useState(() => initialFormValues(producto));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imagenLoading, setImagenLoading] = useState(false);
  const [imagenError, setImagenError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    if (next) setValues(initialFormValues(producto));
    onOpenChange(next);
  }

  // Acción independiente del submit del form: se dispara de inmediato al
  // elegir un archivo, no espera a "Guardar" (ver POST /:id/imagen).
  async function handleImagenChange(file: File | null) {
    if (!file) return;
    setImagenError(null);
    setImagenLoading(true);
    try {
      const formData = new FormData();
      formData.append("imagen", file);
      const actualizado = await apiFetch<Producto>(`/api/productos/${producto.id}/imagen`, {
        method: "POST",
        body: formData,
      });
      onImagenUpdated(actualizado);
    } catch (err) {
      setImagenError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setImagenLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleQuitarImagen() {
    setImagenError(null);
    setImagenLoading(true);
    try {
      const actualizado = await apiFetch<Producto>(`/api/productos/${producto.id}/imagen`, {
        method: "DELETE",
      });
      onImagenUpdated(actualizado);
    } catch (err) {
      setImagenError(err instanceof Error ? err.message : "No se pudo quitar la imagen");
    } finally {
      setImagenLoading(false);
    }
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

          <div className="flex flex-col gap-1.5">
            <Label>Foto</Label>
            <div className="flex items-center gap-3">
              {producto.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagenSrc(producto.imagenUrl)}
                  alt=""
                  className="size-14 rounded object-cover"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                  <ImageIcon className="size-5" />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={imagenLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                {producto.imagenUrl ? "Reemplazar" : "Subir imagen"}
              </Button>
              {producto.imagenUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={imagenLoading}
                  onClick={handleQuitarImagen}
                >
                  Quitar imagen
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
            {imagenError && <p className="text-sm text-destructive">{imagenError}</p>}
          </div>

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
