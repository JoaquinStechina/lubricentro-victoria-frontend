"use client";

import { AlertTriangleIcon, FlaskConicalIcon, ShieldCheckIcon } from "lucide-react";
import { etiquetaAmbiente, type Ambiente } from "@/app/lib/facturacion";
import { useEstadoArca } from "@/app/lib/useEstadoArca";
import { cn } from "@/lib/utils";

// Producción es el estado normal: tono sereno (esmeralda), nada de rojo. Los
// otros dos ambientes no tienen validez fiscal y se leen como "prueba"
// (celeste para la simulación local, ámbar para la homologación de ARCA).
const ESTILOS: Record<Ambiente, { clase: string; texto: string; Icono: typeof FlaskConicalIcon }> = {
  simulado: {
    clase: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    texto: "Los comprobantes son de prueba: ARCA está simulada y no tienen validez fiscal.",
    Icono: FlaskConicalIcon,
  },
  homologacion: {
    clase: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    texto: "Los comprobantes son de prueba: se emiten contra el entorno de homologación de ARCA y no tienen validez fiscal.",
    Icono: FlaskConicalIcon,
  },
  produccion: {
    clase:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    texto: "Los comprobantes tienen validez fiscal.",
    Icono: ShieldCheckIcon,
  },
};

// Muestra contra qué ambiente de ARCA se factura y, si falta configuración,
// los problemas que informa el backend. Si la consulta falla no rompe la
// página: avisa en una línea discreta y listo. La consulta se comparte con
// quien más la necesite en la misma pantalla (useEstadoArca).
export default function EstadoArcaBanner() {
  const carga = useEstadoArca();

  if (!carga.cargado) return null;

  if (carga.fallo || !carga.estado) {
    return (
      <p role="status" className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        No se pudo consultar el estado de ARCA.
      </p>
    );
  }

  const { configurado, ambiente, problemas } = carga.estado;
  const estilo = ambiente ? ESTILOS[ambiente] : null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {estilo && ambiente && (
        <div role="status" className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", estilo.clase)}>
          <estilo.Icono className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">Ambiente {etiquetaAmbiente(ambiente)}.</strong> {estilo.texto}
          </p>
        </div>
      )}
      {!configurado && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">ARCA no está configurada: todavía no se puede facturar.</p>
            {problemas.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
