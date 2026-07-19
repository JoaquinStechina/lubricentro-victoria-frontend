"use client";

import { useState, type FormEvent } from "react";
import { PencilIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import type { RolAsignable, Usuario } from "@/app/lib/usuarios";
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

export default function EditarUsuarioDialog({
  usuario,
  onUpdated,
}: {
  usuario: Usuario;
  onUpdated: (usuario: Usuario) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(usuario.nombre);
  const [rol, setRol] = useState<RolAsignable>(usuario.rol as RolAsignable);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = { nombre, rol };
      if (password) body.password = password;
      const actualizado = await apiFetch<Usuario>(
        `/api/usuarios/${usuario.id}`,
        apiJsonInit(body, "PATCH")
      );
      onUpdated(actualizado);
      setOpen(false);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario");
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
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>{usuario.email}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`editar-nombre-${usuario.id}`}>Nombre</Label>
            <Input
              id={`editar-nombre-${usuario.id}`}
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`editar-rol-${usuario.id}`}>Rol</Label>
            <Select value={rol} onValueChange={(value) => setRol(value as RolAsignable)}>
              <SelectTrigger id={`editar-rol-${usuario.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLEADO">Empleado</SelectItem>
                <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`editar-password-${usuario.id}`}>Nueva contraseña (opcional)</Label>
            <Input
              id={`editar-password-${usuario.id}`}
              type="password"
              minLength={8}
              placeholder="Dejar en blanco para no cambiarla"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

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
