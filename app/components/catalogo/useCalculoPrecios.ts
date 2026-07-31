import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  calcularPrecioConIva,
  calcularPrecioSugerido,
  type ProductoSingleEditField,
} from "@/app/lib/productos";

// Campos que este hook deriva en vez de dejar que el usuario los tipee
// siempre a mano — igual que ReviewTable.tsx en la revisión de cargas.
const CAMPOS_DERIVADOS = new Set<ProductoSingleEditField>([
  "precioConIva",
  "precioListaConIva",
  "precioSugerido",
]);

// "" -> NaN (no 0): "sin valor" es "no calcular todavía", no "vale cero".
function toNum(raw: string | undefined): number {
  const trimmed = (raw ?? "").trim();
  return trimmed === "" ? NaN : Number(trimmed);
}

// Deriva "Precio Neto C/IVA" y "Precio Lista C/IVA" a partir de Precio
// Neto/Lista + IVA%, y de ahí "Precio Sugerido" a partir de un % de
// ganancia auxiliar (no persistido, ver calcularPrecioSugerido) — mismo
// mecanismo que ReviewTable.tsx usa al revisar una carga, para que un
// producto cargado a mano dé el mismo resultado que uno cargado por
// archivo.
//
// Si el usuario edita un campo derivado directamente (ej. corrige a mano el
// Precio Sugerido), ese campo deja de recalcularse hasta que el diálogo se
// cierre y se vuelva a abrir (reset()) — igual que el dirtyRef de
// ReviewTable.tsx, para no pisarle una corrección manual.
//
// El primer cálculo después de abrir el diálogo se salta a propósito: en
// "Editar producto" los campos ya vienen cargados con valores reales del
// producto, y recalcularlos apenas se abre el diálogo (sin que el usuario
// haya tocado nada) los pisaría en silencio con el resultado de la fórmula,
// que puede no coincidir exactamente con lo que se guardó en su momento.
export function useCalculoPrecios(
  values: Record<string, string>,
  setValues: Dispatch<SetStateAction<Record<string, string>>>
) {
  const [porcentajeGanancia, setPorcentajeGanancia] = useState("");
  const dirtyRef = useRef<Set<ProductoSingleEditField>>(new Set());
  const skipRef = useRef(true);

  function handleFieldChange(campo: ProductoSingleEditField, value: string) {
    setValues((prev) => ({ ...prev, [campo]: value }));
    if (CAMPOS_DERIVADOS.has(campo)) dirtyRef.current.add(campo);
  }

  function reset() {
    dirtyRef.current = new Set();
    setPorcentajeGanancia("");
    skipRef.current = true;
  }

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const precioNeto = toNum(values.precioNeto);
    const precioLista = toNum(values.precioLista);
    const iva = toNum(values.alicuotaIva);
    const pct = toNum(porcentajeGanancia);

    setValues((prev) => {
      const next = { ...prev };
      if (!dirtyRef.current.has("precioConIva")) {
        const calc = calcularPrecioConIva(precioNeto, iva);
        if (calc !== null) next.precioConIva = String(calc);
      }
      if (!dirtyRef.current.has("precioListaConIva")) {
        const calc = calcularPrecioConIva(precioLista, iva);
        if (calc !== null) next.precioListaConIva = String(calc);
      }
      if (!dirtyRef.current.has("precioSugerido")) {
        const calc = calcularPrecioSugerido(toNum(next.precioConIva), pct);
        if (calc !== null) next.precioSugerido = String(calc);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.precioNeto, values.precioLista, values.alicuotaIva, porcentajeGanancia]);

  return { porcentajeGanancia, setPorcentajeGanancia, handleFieldChange, reset };
}
