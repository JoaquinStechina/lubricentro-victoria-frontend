// Clases compartidas de los paneles de aviso del módulo de facturación (antes
// copiadas en tres archivos). `break-words` va en la caja base: los mensajes
// de ARCA y los motivos de error son texto libre y un tramo largo sin espacios
// no debe desbordar el panel.
export const CAJA = "rounded-lg border px-4 py-3 text-sm break-words";
export const ROJO = "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200";
export const AMBAR =
  "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100";
export const VERDE =
  "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
export const CELESTE = "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
export const TARJETA = "rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";
