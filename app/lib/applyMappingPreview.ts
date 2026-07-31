import type { CanonicalField, CanonicalRowInput, ColumnMapping, ExtractedRow } from "./cargas";

// Espejo chico de applyMapping en backend/src/extraction/mapping.ts, solo
// para que la tabla de revisión se actualice al instante cuando el usuario
// cambia un mapeo (los datos crudos ya están en el navegador dentro de
// carga.filasExtraidas, recalcular acá es instantáneo). A diferencia del
// backend, esto NO hace parseo tolerante de números — deja todo como texto
// para mostrarlo en un <Input>; el parseo real ("$ 1.985,78" -> 1985.78)
// lo hace normalizeCanonicalRow del lado del servidor, una sola vez, al
// confirmar. Si esta copia se desincroniza el peor caso es una
// previsualización con algún valor mal formateado, nunca un dato mal
// guardado — el backend vuelve a parsear todo desde cero.
// Mantener sincronizado con backend/src/extraction/mapping.ts.
// Columnas que representan un código: al combinar varias columnas de origen
// en este destino, se unen sin separador (reconstruye un código partido en
// dos columnas). El resto de los campos sigue uniéndose con espacio.
// Mantener sincronizado con CAMPOS_CODIGO en backend/src/extraction/mapping.ts.
const CAMPOS_CODIGO = new Set<CanonicalField>(["sku_interno", "sku_proveedor"]);

// Campos numéricos: nunca se combinan concatenando texto (a diferencia de
// descripción, no hay una noción razonable de "unir" dos precios) — el
// backend limpia espacios antes de parsear un número, así que dos precios
// concatenados con espacio terminan mezclados en un entero gigante (caso
// real: ver CAMPOS_NUMERICOS en backend/src/extraction/mapping.ts).
// Mantener sincronizado con ese archivo.
const CAMPOS_NUMERICOS = new Set<CanonicalField>([
  "precio_neto",
  "precio_con_iva",
  "precio_lista",
  "alicuota_iva",
]);

function toDisplayString(value: unknown, destino?: CanonicalField): string {
  if (value === null || value === undefined) return "";
  // Celdas numéricas de xlsx (raw: true, ver backend/src/extraction/excel.ts)
  // pueden traer arrastre de punto flotante (ej. 1234.5600000000001) que
  // String() muestra tal cual — se ve "de terror" en la tabla de revisión
  // aunque el dato final que guarda el backend ya sale redondeado
  // (normalizeCanonicalRow usa roundTo2). Acá es solo cosmético: redondear
  // antes de mostrar para campos de precio/IVA cuando el valor crudo es un
  // number real (si ya viene como texto con formato, ej. "$ 1.985,78", se
  // deja igual — el parseo tolerante de ese formato lo hace el backend).
  if (typeof value === "number" && destino && CAMPOS_NUMERICOS.has(destino)) {
    return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "";
  }
  return String(value).trim();
}

export function applyMappingPreview(
  headers: string[],
  rows: ExtractedRow[],
  mapping: ColumnMapping
): CanonicalRowInput[] {
  return rows.map((row) => {
    const valoresPorDestino = new Map<CanonicalField, string[]>();
    const rawData: Record<string, unknown> = {};

    for (const h of headers) {
      const destinos = mapping[h];
      const valor = row[h];
      if (destinos && destinos.length > 0) {
        for (const destino of destinos) {
          const lista = valoresPorDestino.get(destino) ?? [];
          lista.push(toDisplayString(valor, destino));
          valoresPorDestino.set(destino, lista);
        }
      } else if (valor !== null && valor !== undefined && valor !== "") {
        rawData[h] = valor;
      }
    }

    // Si dos o más columnas mapean al mismo campo (ej. "Producto" y "Envase"
    // -> descripcion), se concatenan en orden salteando valores vacíos —
    // salvo un campo numérico (CAMPOS_NUMERICOS), que nunca se concatena.
    // Mantener sincronizado con applyMapping en backend/src/extraction/mapping.ts.
    const canonical: Partial<Record<CanonicalField, string>> = {};
    for (const [destino, valores] of valoresPorDestino) {
      const limpios = valores.filter((v) => v !== "");
      canonical[destino] = CAMPOS_NUMERICOS.has(destino)
        ? (limpios[0] ?? "")
        : limpios.join(CAMPOS_CODIGO.has(destino) ? "" : " ");
    }

    // seccion/marca: si no vinieron de una columna mapeada, caen del campo
    // especial que dejan excel.ts (__hoja/__seccion) o vision.ts (_seccion)
    // al extraer — mismo fallback que applyMapping en el backend.
    if (!canonical.seccion) {
      const seccion = row.__seccion ?? row._seccion;
      if (seccion !== undefined && seccion !== null) canonical.seccion = toDisplayString(seccion);
    }
    if (!canonical.marca) {
      const marca = row.__hoja;
      if (marca !== undefined && marca !== null) canonical.marca = toDisplayString(marca);
    }
    if (!canonical.moneda) canonical.moneda = "ARS";

    return { ...canonical, raw_data: rawData };
  });
}
