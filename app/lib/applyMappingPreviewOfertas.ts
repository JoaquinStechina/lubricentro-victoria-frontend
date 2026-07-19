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
// hora_oferta con la metadata "de todo el archivo" cuando el campo no vino
// de una columna mapeada. Mantener sincronizado con
// backend/src/extraction/mappingOfertas.ts#applyMappingOfertas.
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function applyMappingPreviewOfertas(
  headers: string[],
  rows: ExtractedRow[],
  mapping: OfertaColumnMapping,
  metadata: OfertaMetadata
): OfertaRowInput[] {
  return rows.map((row) => {
    const canonical: Partial<Record<OfertaField, string>> = {};
    const rawData: Record<string, unknown> = {};

    for (const h of headers) {
      const destino = mapping[h];
      const valor = row[h];
      if (destino) {
        canonical[destino] = toDisplayString(valor);
      } else if (valor !== null && valor !== undefined && valor !== "") {
        rawData[h] = valor;
      }
    }

    if (!canonical.marca && metadata.marca) canonical.marca = metadata.marca;
    if (!canonical.numero_oferta && metadata.numero_oferta) {
      canonical.numero_oferta = metadata.numero_oferta;
    }
    if (!canonical.fecha_oferta && metadata.fecha_oferta) canonical.fecha_oferta = metadata.fecha_oferta;
    if (!canonical.hora_oferta && metadata.hora_oferta) canonical.hora_oferta = metadata.hora_oferta;
    if (!canonical.moneda) canonical.moneda = "ARS";

    return { ...canonical, raw_data: rawData };
  });
}
