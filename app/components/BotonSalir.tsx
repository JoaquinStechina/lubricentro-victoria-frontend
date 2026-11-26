"use client";

import { useState } from "react";
import { LogOutIcon } from "lucide-react";
import { RUTA_ENTRAR, fetchApi } from "@/app/lib/sesion";
import { Button } from "@/components/ui/button";

// Cierra la sesión de ESTE navegador: la API borra la cookie. Las sesiones de
// otras PC siguen abiertas hasta que vencen o se cambia la clave.
export default function BotonSalir() {
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    if (saliendo) return;
    setSaliendo(true);
    try {
      await fetchApi("/api/acceso/salir", { method: "POST" });
    } catch {
      // Sin red igual se va a la pantalla de entrar; la cookie vence sola.
    }
    // Navegación completa: no queda nada de la sesión en memoria.
    window.location.assign(RUTA_ENTRAR);
  }

  return (
    <Button variant="outline" onClick={() => void salir()} disabled={saliendo} title="Cerrar la sesión en esta PC">
      <LogOutIcon />
      Salir
    </Button>
  );
}
