"use client";

import { useEffect, useState } from "react";
import { fetchFacturacion, type EstadoArca } from "@/app/lib/facturacion";

export type CargaEstadoArca = { estado: EstadoArca | null; fallo: boolean; cargado: boolean };

// Consulta en vuelo compartida: el banner y la pantalla que lo usa para
// decidir (p. ej. deshabilitar "Facturar") se montan juntos y hacen UNA sola
// petición a GET /api/facturacion/estado. No se cachea el resultado: cada
// montaje vuelve a preguntar, así que un cambio de configuración se ve al
// recargar o navegar.
let enVuelo: Promise<EstadoArca> | null = null;

function consultar(): Promise<EstadoArca> {
  if (!enVuelo) {
    enVuelo = fetchFacturacion<EstadoArca>("/api/facturacion/estado")
      .then((res) => res.data)
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

export function useEstadoArca(): CargaEstadoArca {
  const [carga, setCarga] = useState<CargaEstadoArca>({ estado: null, fallo: false, cargado: false });

  useEffect(() => {
    let active = true;
    consultar()
      .then((estado) => {
        if (active) setCarga({ estado, fallo: false, cargado: true });
      })
      .catch(() => {
        if (active) setCarga({ estado: null, fallo: true, cargado: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return carga;
}
