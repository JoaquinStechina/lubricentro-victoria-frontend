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

export type Carga = {
  id: number;
  proveedorId: number | null;
  proveedor: Proveedor | null;
  nombreArchivo: string;
  rutaArchivo: string;
  tipoArchivo: TipoArchivo;
  estado: CargaEstado;
  mensajeError: string | null;
  filasExtraidas: { headers: string[]; rows: ExtractedRow[] } | null;
  mapeoSugerido: ColumnMapping | null;
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
