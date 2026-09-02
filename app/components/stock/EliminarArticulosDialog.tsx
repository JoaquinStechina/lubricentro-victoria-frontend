"use client";

import { useState } from "react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EliminarArticulosDialog({
  ids,
  open,
  onOpenChange,
  onEliminado,
}: {
  ids: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEliminado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch<{ eliminados: number }>("/api/stock/eliminar", apiJsonInit({ ids }, "POST"));
      onEliminado();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron eliminar los artículos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            ¿Eliminar {ids.length} artículo{ids.length > 1 ? "s" : ""}?
          </DialogTitle>
          <DialogDescription>
            Es un borrado lógico: los artículos se ocultan del listado, pero se pueden restaurar desde la papelera
            cuando haga falta.
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
