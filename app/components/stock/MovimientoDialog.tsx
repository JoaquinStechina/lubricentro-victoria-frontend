"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpDownIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import type { ArticuloStock, MovimientoStock, TipoMovimiento } from "@/app/lib/stock";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TIPO_OPTIONS: { value: TipoMovimiento; label: string }[] = [
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
  { value: "ajuste", label: "Ajuste por conteo" },
];

// Registrar un movimiento de stock. La previsualización del resultado es
// solo una advertencia, nunca un bloqueo: el backend permite que el stock
// quede en negativo a propósito (POST /:id/movimientos no lo rechaza). Un
// negativo es la señal de que faltó cargar una entrada — si bloqueáramos
// acá, el efecto sería que la gente deja de registrar movimientos.
export default function MovimientoDialog({
  articulo,
  onRegistrado,
}: {
  articulo: ArticuloStock;
  onRegistrado: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoMovimiento>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setTipo("entrada");
    setCantidad("");
    setMotivo("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  const labelCantidad =
    tipo === "ajuste" ? "Cantidad contada" : tipo === "entrada" ? "Cantidad que entra" : "Cantidad que sale";

  const resultado =
    tipo === "ajuste"
      ? Number(cantidad || 0)
      : tipo === "entrada"
        ? articulo.cantidad + Number(cantidad || 0)
        : articulo.cantidad - Number(cantidad || 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cantidad.trim() === "") {
      setError("Ingresá una cantidad.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiFetch<MovimientoStock>(
        `/api/stock/${articulo.id}/movimientos`,
        apiJsonInit({
          tipo,
          cantidad: Number(cantidad),
          motivo: motivo.trim() || null,
        })
      );
      onRegistrado();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el movimiento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <ArrowUpDownIcon />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>
              {articulo.marca} · {articulo.codigo}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`movimiento-tipo-${articulo.id}`}>Tipo</Label>
            <Select value={tipo} onValueChange={(value) => setTipo(value as TipoMovimiento)}>
              <SelectTrigger id={`movimiento-tipo-${articulo.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`movimiento-cantidad-${articulo.id}`}>{labelCantidad}</Label>
            <Input
              id={`movimiento-cantidad-${articulo.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`movimiento-motivo-${articulo.id}`}>Motivo (opcional)</Label>
            <Textarea
              id={`movimiento-motivo-${articulo.id}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: rotura, préstamo a otro local, conteo físico…"
            />
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Stock actual: {articulo.cantidad} → queda en{" "}
            <span className={resultado < 0 ? "font-medium text-destructive" : "font-medium"}>{resultado}</span>
            {resultado < 0 && <span className="block text-destructive">El stock quedará en negativo.</span>}
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
