import type {
  OfertaField,
  OfertaColumnMapping,
  OfertaMetadata,
  OfertaRowInput,
  ExtractedRow,
} from "./cargas";

// Paralelo a applyMappingPreview.ts (mismo criterio: solo texto, sin parseo
// tolerante — eso lo hace normalizeOfertaRow del lado del servidor al
// confirmar), pero además completa marca/numero_oferta/fecha_oferta/
// hora_oferta/fecha_hasta con la metadata "de todo el archivo" cuando el
// campo no vino de una columna mapeada. Mantener sincronizado con
// backend/src/extraction/mappingOfertas.ts#applyMappingOfertas.
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

// Campos numéricos: nunca se combinan concatenando texto — ver
// CAMPOS_NUMERICOS_OFERTA en backend/src/extraction/mappingOfertas.ts.
// Mantener sincronizado con ese archivo.
const CAMPOS_NUMERICOS_OFERTA = new Set<OfertaField>([
  "desde_cantidad",
  "descuento_pct",
  "precio_unitario",
  "cantidad_disponible",
]);

export function applyMappingPreviewOfertas(
  headers: string[],
  rows: ExtractedRow[],
  mapping: OfertaColumnMapping,
  metadata: OfertaMetadata
): OfertaRowInput[] {
  return rows.map((row) => {
    const valoresPorDestino = new Map<OfertaField, string[]>();
    const rawData: Record<string, unknown> = {};

    for (const h of headers) {
      const destino = mapping[h];
      const valor = row[h];
      if (destino) {
        const lista = valoresPorDestino.get(destino) ?? [];
        lista.push(toDisplayString(valor));
        valoresPorDestino.set(destino, lista);
      } else if (valor !== null && valor !== undefined && valor !== "") {
        rawData[h] = valor;
      }
    }

    // Si dos o más columnas mapean al mismo campo, se concatenan en orden
    // separadas por espacio — salvo un campo numérico
    // (CAMPOS_NUMERICOS_OFERTA), que nunca se concatena. Mantener
    // sincronizado con applyMappingOfertas en
    // backend/src/extraction/mappingOfertas.ts.
    const canonical: Partial<Record<OfertaField, string>> = {};
    for (const [destino, valores] of valoresPorDestino) {
      const limpios = valores.filter((v) => v !== "");
      canonical[destino] = CAMPOS_NUMERICOS_OFERTA.has(destino) ? (limpios[0] ?? "") : limpios.join(" ");
    }

    if (!canonical.marca && metadata.marca) canonical.marca = metadata.marca;
    if (!canonical.numero_oferta && metadata.numero_oferta) {
      canonical.numero_oferta = metadata.numero_oferta;
    }
    if (!canonical.fecha_oferta && metadata.fecha_oferta) canonical.fecha_oferta = metadata.fecha_oferta;
    if (!canonical.hora_oferta && metadata.hora_oferta) canonical.hora_oferta = metadata.hora_oferta;
    if (!canonical.fecha_hasta && metadata.fecha_hasta) canonical.fecha_hasta = metadata.fecha_hasta;
    if (!canonical.moneda) canonical.moneda = "ARS";

    return { ...canonical, raw_data: rawData };
  });
}
