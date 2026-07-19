"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import type { Usuario } from "@/app/lib/usuarios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CrearUsuarioDialog from "@/app/components/usuarios/CrearUsuarioDialog";
import EditarUsuarioDialog from "@/app/components/usuarios/EditarUsuarioDialog";

const ROL_LABELS: Record<string, string> = {
  SYSADMIN: "Sysadmin",
  ADMINISTRADOR: "Administrador",
  EMPLEADO: "Empleado",
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

export default function UsuariosView() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<Usuario[]>("/api/usuarios")
      .then((data) => {
        if (active) setUsuarios(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo cargar la lista");
      });
    return () => {
      active = false;
    };
  }, []);

  function upsert(usuario: Usuario) {
    setUsuarios((prev) => {
      if (!prev) return [usuario];
      const existe = prev.some((u) => u.id === usuario.id);
      return existe ? prev.map((u) => (u.id === usuario.id ? usuario : u)) : [...prev, usuario];
    });
  }

  async function toggleActivo(usuario: Usuario) {
    setTogglingId(usuario.id);
    try {
      const actualizado = await apiFetch<Usuario>(
        `/api/usuarios/${usuario.id}`,
        apiJsonInit({ activo: !usuario.activo }, "PATCH")
      );
      upsert(actualizado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CrearUsuarioDialog onCreated={upsert} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!usuarios ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando usuarios...</p>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell>{usuario.nombre}</TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">{usuario.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROL_LABELS[usuario.rol] ?? usuario.rol}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={usuario.activo ? "secondary" : "destructive"}>
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-500 dark:text-zinc-500">
                    {dateFormatter.format(new Date(usuario.createdAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    {usuario.rol === "SYSADMIN" ? (
                      <span className="text-xs text-zinc-400">—</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <EditarUsuarioDialog usuario={usuario} onUpdated={upsert} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={togglingId === usuario.id}
                          onClick={() => toggleActivo(usuario)}
                        >
                          {usuario.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
