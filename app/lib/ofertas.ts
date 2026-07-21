// Tipo que devuelve el backend real (Express/Prisma, repo hermano `backend/`)
// en GET /api/ofertas — ver backend/src/routes/ofertas.ts. Reemplaza al
// prototipo anterior que leía data/ofertas.json en memoria.
export type Oferta = {
  id: number;
  proveedorId: number;
  proveedor: { id: number; nombre: string } | null;
  marca: string;
  numeroOferta: number;
  skuProveedor: string;
  descripcion: string;
  desdeCantidad: number;
  descuentoPct: number;
  precioUnitario: number;
  moneda: string;
  fechaOferta: string;
  horaOferta: string;
  fechaHasta: string | null;
  imagenUrl: string | null;
  activa: boolean;
  eliminado: boolean;
  archivoOrigen: string;
  rawData: Record<string, unknown> | null;
  cargaId: number | null;
  createdAt: string;
};

// Claves de filtro por columna (se mandan como f_<clave> al backend).
// Descuento y precio unitario se filtran por rango (clave Min/Max) — esto
// además corrige el nombre viejo "descuento", que el backend nunca leyó.
export type OfertaColumnKey =
  | "marca"
  | "numeroOferta"
  | "sku"
  | "descripcion"
  | "desdeCantidad"
  | "descuentoPctMin"
  | "descuentoPctMax"
  | "precioUnitarioMin"
  | "precioUnitarioMax"
  | "fechaOferta"
  | "vigencia"
  | "fechaHasta";

// Campos que puede tocar PATCH /api/ofertas/:id (edición de una fila). No
// incluye `activa`: eso solo lo tocan POST /cerrar y /reactivar.
export const OFERTA_SINGLE_EDIT_FIELDS = [
  "marca",
  "numeroOferta",
  "skuProveedor",
  "descripcion",
  "desdeCantidad",
  "descuentoPct",
  "precioUnitario",
  "moneda",
  "fechaOferta",
  "horaOferta",
  "fechaHasta",
] as const;
export type OfertaSingleEditField = (typeof OFERTA_SINGLE_EDIT_FIELDS)[number];

// Campos que puede tocar POST /api/ofertas/editar-lote (subset más chico:
// excluye identificadores como marca/numeroOferta/skuProveedor/descripcion).
export const OFERTA_BULK_EDIT_FIELDS = [
  "desdeCantidad",
  "descuentoPct",
  "precioUnitario",
  "moneda",
  "fechaOferta",
  "horaOferta",
  "fechaHasta",
] as const;
export type OfertaBulkEditField = (typeof OFERTA_BULK_EDIT_FIELDS)[number];

export const OFERTA_FIELD_LABELS: Record<OfertaSingleEditField, string> = {
  marca: "Marca",
  numeroOferta: "N° oferta",
  skuProveedor: "SKU proveedor",
  descripcion: "Descripción",
  desdeCantidad: "Desde cantidad",
  descuentoPct: "Descuento %",
  precioUnitario: "Precio unitario",
  moneda: "Moneda",
  fechaOferta: "Fecha oferta",
  horaOferta: "Hora oferta",
  fechaHasta: "Vigente hasta",
};

export const OFERTA_NUMERIC_FIELDS = new Set<string>([
  "numeroOferta",
  "desdeCantidad",
  "descuentoPct",
  "precioUnitario",
]);
