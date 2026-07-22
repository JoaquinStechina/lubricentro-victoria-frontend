"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImageIcon, XIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import {
  OFERTA_FIELD_LABELS,
  OFERTA_NULLABLE_FIELDS,
  OFERTA_NUMERIC_FIELDS,
  OFERTA_SINGLE_EDIT_FIELDS,
  type Oferta,
} from "@/app/lib/ofertas";
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
  for (const campo of OFERTA_SINGLE_EDIT_FIELDS) values[campo] = "";
  return values;
}

// desdeCantidad/descuentoPct/moneda son opcionales al alta manual: el
// backend les aplica default 1/0/"ARS" si quedan vacíos (mismo criterio que
// las filas de archivo, ver normalizeOfertaRow y POST /api/ofertas en el
// backend).
const CAMPOS_CON_DEFAULT = new Set(["desdeCantidad", "descuentoPct", "moneda"]);

// Alta manual de una oferta suelta, en paralelo al pipeline de carga masiva
// de archivos — ver POST /api/ofertas en el backend.
export default function NuevaOfertaDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (oferta: Oferta) => void;
}) {
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [values, setValues] = useState(emptyFormValues);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      for (const campo of OFERTA_SINGLE_EDIT_FIELDS) {
        const raw = values[campo].trim();
        if (campo === "fechaHasta") {
          body[campo] = raw === "" ? null : raw;
        } else if (OFERTA_NUMERIC_FIELDS.has(campo)) {
          body[campo] = raw === "" ? undefined : Number(raw);
        } else {
          body[campo] = raw;
        }
      }
      let oferta = await apiFetch<Oferta>("/api/ofertas", apiJsonInit(body, "POST"));
      if (imagenFile) {
        const formData = new FormData();
        formData.append("imagen", imagenFile);
        oferta = await apiFetch<Oferta>(`/api/ofertas/${oferta.id}/imagen`, {
          method: "POST",
          body: formData,
        });
      }
      onCreated(oferta);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la oferta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nueva oferta</DialogTitle>
            <DialogDescription>Alta manual, sin pasar por una carga de archivo.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>Proveedor</Label>
            <ProveedorCombobox value={proveedorNombre} onChange={setProveedorNombre} className="w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OFERTA_SINGLE_EDIT_FIELDS.map((campo) => (
              <div key={campo} className="flex flex-col gap-1.5">
                <Label htmlFor={`nueva-oferta-${campo}`}>{OFERTA_FIELD_LABELS[campo]}</Label>
                <Input
                  id={`nueva-oferta-${campo}`}
                  required={!OFERTA_NULLABLE_FIELDS.has(campo) && !CAMPOS_CON_DEFAULT.has(campo)}
                  placeholder={
                    campo === "fechaHasta"
                      ? "vacío = hasta agotar stock"
                      : campo === "cantidadDisponible"
                        ? "vacío = sin dato"
                        : campo === "desdeCantidad"
                          ? "vacío = 1"
                          : campo === "descuentoPct"
                            ? "vacío = 0"
                            : campo === "moneda"
                              ? "vacío = ARS"
                              : undefined
                  }
                  value={values[campo]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [campo]: e.target.value }))}
                  inputMode={OFERTA_NUMERIC_FIELDS.has(campo) ? "decimal" : "text"}
                />
              </div>
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
              {loading ? "Creando..." : "Crear oferta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
