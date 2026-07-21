// Tipos del dominio de carga/revisión de archivos. Mantener sincronizado
// con backend/src/extraction/types.ts y backend/prisma/schema.prisma —
// no hay paquete compartido entre los dos repos (son repos hermanos
// independientes), así que esto es una copia deliberada, no generada.

export const CANONICAL_FIELDS = [
  "marca",
  "sku_proveedor",
  "sku_interno",
  "descripcion",
  "seccion",
  "precio_neto",
  "precio_con_iva",
  "alicuota_iva",
  "moneda",
  "unidad",
  "fecha_vigencia",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const CANONICAL_FIELD_LABELS: Record<CanonicalField, string> = {
  marca: "Marca",
  sku_proveedor: "SKU proveedor",
  sku_interno: "SKU interno",
  descripcion: "Descripción",
  seccion: "Sección",
  precio_neto: "Precio neto",
  precio_con_iva: "Precio c/IVA",
  alicuota_iva: "IVA %",
  moneda: "Moneda",
  unidad: "Unidad",
  fecha_vigencia: "Vigencia",
};

// Schema canónico de ofertas (descuentos por SKU con tramos de cantidad) —
// ver backend/src/extraction/typesOfertas.ts y docs/plan-ofertas.md. Copia
// deliberada, paralela a CANONICAL_FIELDS, no una variante genérica.
export const CANONICAL_FIELDS_OFERTAS = [
  "marca",
  "numero_oferta",
  "sku_proveedor",
  "descripcion",
  "desde_cantidad",
  "descuento_pct",
  "precio_unitario",
  "moneda",
  "fecha_oferta",
  "hora_oferta",
  "fecha_hasta",
] as const;

export type OfertaField = (typeof CANONICAL_FIELDS_OFERTAS)[number];

export const OFERTA_FIELD_LABELS: Record<OfertaField, string> = {
  marca: "Marca",
  numero_oferta: "N° oferta",
  sku_proveedor: "SKU proveedor",
  descripcion: "Descripción",
  desde_cantidad: "Desde cantidad",
  descuento_pct: "Descuento %",
  precio_unitario: "Precio unitario",
  moneda: "Moneda",
  fecha_oferta: "Fecha oferta",
  hora_oferta: "Hora oferta",
  fecha_hasta: "Válida hasta",
};

export type OfertaColumnMapping = Record<string, OfertaField>;

export type OfertaRowInput = Partial<Record<OfertaField, string>> & {
  raw_data?: Record<string, unknown>;
};

// Marca/n° de oferta/fecha/hora "de todo el archivo", auto-detectados por
// IA y editables una sola vez para toda la carga (ver docs/plan-ofertas.md,
// punto 2). Los 4 campos son independientes de las columnas de la tabla.
export type OfertaMetadata = {
  marca?: string | null;
  numero_oferta?: string | null;
  fecha_oferta?: string | null;
  hora_oferta?: string | null;
  // Vencimiento de la oferta (YYYY-MM-DD). Vacío/null = sin fecha fija
  // ("hasta agotar stock") — se cierra manualmente desde /cargas/gestion,
  // no expira sola.
  fecha_hasta?: string | null;
};

// Fila cruda tal como la extrajo excel.ts/vision.ts: claves = headers
// originales del archivo del proveedor, valores sin normalizar.
export type ExtractedRow = Record<string, unknown>;

// columnaOrigen -> campoDestino.
export type ColumnMapping = Record<string, CanonicalField>;

// Fila ya en forma canónica (después de aplicar el mapeo). Los valores
// numéricos/texto viajan como string hacia el backend — el parseo
// tolerante ("$ 1.985,78" -> 1985.78) lo hace normalizeCanonicalRow del
// lado del servidor, una sola vez, al confirmar.
export type CanonicalRowInput = Partial<Record<CanonicalField, string>> & {
  raw_data?: Record<string, unknown>;
};

// Etapa 5 (ver contexto.md): chequeos determinísticos que corre el backend
// como paso aparte (GET /api/uploads/:id/advertencias) cuando se abre la
// pantalla de revisión — no bloquean ni corrigen nada, son informativas.
export type Advertencia = {
  fila: number; // índice dentro de filasExtraidas.rows, mismo orden que las filas de la tabla
  campo: string;
  mensaje: string;
};

export type Proveedor = {
  id: number;
  nombre: string;
};

export type CargaEstado =
  | "pendiente"
  | "procesando"
  | "revision_pendiente"
  | "confirmacion_pendiente"
  | "completado"
  | "error";

export type TipoArchivo = "xlsx" | "xls" | "pdf" | "png" | "jpg" | "jpeg";

export type TipoDatos = "catalogo" | "oferta";

export const TIPO_DATOS_LABELS: Record<TipoDatos, string> = {
  catalogo: "Catálogo",
  oferta: "Oferta",
};

export type Carga = {
  id: number;
  proveedorId: number | null;
  proveedor: Proveedor | null;
  nombreArchivo: string;
  rutaArchivo: string;
  tipoArchivo: TipoArchivo;
  tipoDatos: TipoDatos;
  // Solo relevante si tipoDatos = "oferta": el usuario marcó al subir el
  // archivo que la oferta no tiene fecha de cierre ("hasta agotar stock").
  sinFechaLimite: boolean;
  estado: CargaEstado;
  mensajeError: string | null;
  filasExtraidas: { headers: string[]; rows: ExtractedRow[] } | null;
  mapeoSugerido: ColumnMapping | OfertaColumnMapping | null;
  metadataOferta: OfertaMetadata | null;
  createdAt: string;
  updatedAt: string;
};

export const ESTADO_LABELS: Record<CargaEstado, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando",
  revision_pendiente: "Mapeo nuevo — revisar",
  confirmacion_pendiente: "Confirmar valores",
  completado: "Completado",
  error: "Error",
};

export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".pdf", ".png", ".jpg", ".jpeg"];
