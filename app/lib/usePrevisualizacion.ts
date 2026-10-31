"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorApi, fetchFacturacion, type ItemEntrada, type Previsualizacion } from "@/app/lib/facturacion";
import { itemsParaPrevisualizar, type ItemFormulario } from "@/app/lib/ventasForm";

const DEBOUNCE_PREVIEW_MS = 300;

// Resultado de una vista previa, etiquetado con la consulta que lo originó
// (`clave`): "está al día" se deriva comparando con la consulta vigente, así
// una respuesta vieja y lenta nunca se muestra como si fuera la actual.
type ResultadoPreview =
  | { clave: string; ok: true; data: Previsualizacion }
  | { clave: string; ok: false; error: ErrorApi };

// Vista previa con debounce de POST /api/ventas/previsualizar: ÚNICA fuente de
// totales (el cliente nunca calcula). Compartida por la nueva venta y por las
// notas parciales/de débito. `habilitado: false` apaga la consulta (p. ej. una
// anulación total, que no lleva ítems).
export function usePrevisualizacion({
  items,
  clienteId,
  preciosIncluyenIva,
  habilitado = true,
}: {
  items: ItemFormulario[];
  clienteId: number | null;
  preciosIncluyenIva: boolean;
  habilitado?: boolean;
}) {
  const itemsPreview: ItemEntrada[] | null = useMemo(
    () => (habilitado ? itemsParaPrevisualizar(items) : null),
    [items, habilitado],
  );
  // Lo único que cambia el cálculo: cliente, tilde de IVA y cantidad/precio/
  // alícuota. La descripción no, para no consultar por cada tecla.
  const claveConsulta = useMemo(
    () => (itemsPreview ? JSON.stringify({ clienteId, preciosIncluyenIva, items: itemsPreview }) : null),
    [itemsPreview, clienteId, preciosIncluyenIva],
  );
  const [reintento, setReintento] = useState(0);
  const claveVigente = claveConsulta ? `${reintento}|${claveConsulta}` : null;

  const [claveDebounced, setClaveDebounced] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setClaveDebounced(claveVigente), DEBOUNCE_PREVIEW_MS);
    return () => clearTimeout(id);
  }, [claveVigente]);

  const [preview, setPreview] = useState<ResultadoPreview | null>(null);
  useEffect(() => {
    if (claveDebounced === null) return;
    let active = true;
    // El cuerpo se arma desde la propia clave: lo que se consulta es
    // exactamente lo que identifica el resultado.
    const cuerpo = claveDebounced.slice(claveDebounced.indexOf("|") + 1);
    fetchFacturacion<Previsualizacion>("/api/ventas/previsualizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cuerpo,
    })
      .then((res) => {
        if (active) setPreview({ clave: claveDebounced, ok: true, data: res.data });
      })
      .catch((err: unknown) => {
        if (active) {
          setPreview({
            clave: claveDebounced,
            ok: false,
            error: err instanceof ErrorApi ? err : new ErrorApi(0, "No se pudo calcular el resumen."),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [claveDebounced]);

  // Está al día solo si es la respuesta a la consulta vigente. Mientras tanto
  // (tipeando, request en vuelo) el resumen se atenúa y no se puede emitir.
  const previewAlDia = preview !== null && claveVigente !== null && preview.clave === claveVigente;
  const calculando = claveVigente !== null && !previewAlDia;
  const calculo = previewAlDia && preview.ok ? preview.data : null;
  const errorPreview = previewAlDia && !preview.ok ? preview.error : null;

  return {
    itemsPreview,
    previewAlDia,
    calculando,
    calculo,
    errorPreview,
    reintentar: () => setReintento((n) => n + 1),
  };
}
