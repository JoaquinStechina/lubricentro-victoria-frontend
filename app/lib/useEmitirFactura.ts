"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorApi, fetchFacturacion, jsonInit, type ComprobanteConItems } from "@/app/lib/facturacion";
import { nuevaClave } from "@/app/lib/ventasForm";

// Resultado de un intento de facturar una venta. Solo `error` es una falla de
// la petición (no hubo comprobante); `fallido` es un comprobante que ARCA
// rechazó o que terminó en error: el backend lo responde con 201 aunque no sea
// un éxito, así que se decide por `estado`, no por el status HTTP.
export type ResultadoEmision =
  | { tipo: "autorizado"; ventaId: number; comprobante: ComprobanteConItems }
  | { tipo: "pendiente"; ventaId: number; comprobante: ComprobanteConItems }
  | { tipo: "fallido"; ventaId: number; comprobante: ComprobanteConItems }
  | { tipo: "error"; ventaId: number; error: ErrorApi };

function clasificar(ventaId: number, status: number, comprobante: ComprobanteConItems): ResultadoEmision {
  if (comprobante.estado === "autorizado") return { tipo: "autorizado", ventaId, comprobante };
  // 202 es la señal explícita de "pendiente de confirmar con ARCA".
  if (status === 202 || comprobante.estado === "pendiente") return { tipo: "pendiente", ventaId, comprobante };
  return { tipo: "fallido", ventaId, comprobante };
}

// Flujo de "facturar una venta" compartido por la nueva venta y el listado.
//
// Idempotencia: la claveIdempotencia identifica una INTENCIÓN de emitir. Se
// crea una vez por venta y se REUTILIZA mientras no haya respuesta con un
// comprobante (error de red, timeout, 5xx, doble clic): si el servidor sí
// procesó el pedido, repetir la misma clave devuelve ese comprobante en vez de
// facturar dos veces. Recién cuando el backend responde con un comprobante (de
// cualquier estado) la intención terminó: el próximo intento del usuario —por
// ejemplo "Reintentar facturación" tras un rechazo— usa una clave nueva, porque
// con la misma el backend devolvería otra vez el comprobante rechazado.
//
// Doble envío: `enVuelo` es un ref (no solo el estado `emitiendoId`, que recién
// se actualiza en el próximo render): dos clics en el mismo tick no pasan.
export function useEmitirFactura() {
  const router = useRouter();
  const [emitiendoId, setEmitiendoId] = useState<number | null>(null);
  const [resultado, setResultado] = useState<ResultadoEmision | null>(null);
  const enVuelo = useRef(false);
  const claves = useRef(new Map<number, string>());
  // Si el usuario se va de la pantalla mientras la emisión está en curso, la
  // respuesta llega a un componente desmontado: no hay que arrastrarlo al
  // comprobante desde otra pantalla. (El comprobante igual queda emitido: se
  // lo encuentra desde Comprobantes.)
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Devuelve null si ya había una emisión en curso (el segundo clic se ignora;
  // el primero es quien procesa el resultado).
  const emitir = useCallback(
    async (ventaId: number): Promise<ResultadoEmision | null> => {
      if (enVuelo.current) return null;
      enVuelo.current = true;
      setEmitiendoId(ventaId);
      setResultado(null);

      let claveIdempotencia = claves.current.get(ventaId);
      if (!claveIdempotencia) {
        claveIdempotencia = nuevaClave();
        claves.current.set(ventaId, claveIdempotencia);
      }

      let final: ResultadoEmision;
      try {
        const res = await fetchFacturacion<ComprobanteConItems>(
          "/api/facturacion/comprobantes",
          jsonInit({ ventaId, claveIdempotencia }, "POST"),
        );
        // El backend respondió con un comprobante: la intención terminó.
        claves.current.delete(ventaId);
        final = clasificar(ventaId, res.status, res.data);
      } catch (err) {
        // Sin comprobante: la clave se conserva para el próximo intento.
        const error = err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo emitir la factura.");
        final = { tipo: "error", ventaId, error };
      }

      setResultado(final);
      if (final.tipo === "autorizado") {
        // No se libera `enVuelo` ni `emitiendoId`: la pantalla se está yendo al
        // comprobante y un clic más en "Facturar" generaría (con clave nueva)
        // una segunda factura.
        if (montado.current) router.push(`/facturacion/${final.comprobante.id}`);
        return final;
      }
      enVuelo.current = false;
      setEmitiendoId(null);
      return final;
    },
    [router],
  );

  const limpiarResultado = useCallback(() => setResultado(null), []);

  return { emitir, emitiendoId, resultado, limpiarResultado };
}
