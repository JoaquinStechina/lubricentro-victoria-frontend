"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/api";
import type { AutoDescargaMarca } from "@/app/lib/autoDescargas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EliminarAutoDescargaDialog({
  fila,
  open,
  onOpenChange,
  onDeleted,
}: {
  fila: AutoDescargaMarca;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch<{ id: number }>(`/api/auto-descargas/${fila.id}`, { method: "DELETE" });
      onDeleted(fila.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la marca");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            ¿Eliminar &quot;{fila.marca}&quot; de {fila.proveedor.nombre}?
          </DialogTitle>
          <DialogDescription>
            Se deja de auto-descargar esta marca. No se puede deshacer desde la interfaz.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Eliminando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
