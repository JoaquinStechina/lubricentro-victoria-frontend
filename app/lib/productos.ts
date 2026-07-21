// Tipo que devuelve el backend real (Express/Prisma, repo hermano `backend/`)
// en GET /api/productos — ver backend/src/routes/productos.ts. Reemplaza al
// prototipo anterior que leía data/productos_todos.json en memoria.
export type Producto = {
  id: number;
  proveedorId: number;
  proveedor: { id: number; nombre: string } | null;
  marca: string | null;
  skuProveedor: string | null;
  skuInterno: string | null;
  descripcion: string | null;
  seccion: string | null;
  precioNeto: number | null;
  precioConIva: number | null;
  alicuotaIva: number | null;
  moneda: string;
  unidad: string | null;
  fechaVigencia: string | null;
  vigente: boolean;
  eliminado: boolean;
  rawData: Record<string, unknown> | null;
  cargaId: number | null;
  createdAt: string;
};

// Claves de filtro por columna (se mandan como f_<clave> al backend). Los
// precios se filtran por rango, por eso tienen clave Min y Max separadas.
export type ProductoColumnKey =
  | "proveedor"
  | "marca"
  | "sku"
  | "descripcion"
  | "seccion"
  | "precioNetoMin"
  | "precioNetoMax"
  | "precioConIvaMin"
  | "precioConIvaMax"
  | "alicuotaIva"
  | "fechaVigencia";

// Campos que puede tocar PATCH /api/productos/:id (edición de una fila).
export const PRODUCTO_SINGLE_EDIT_FIELDS = [
  "marca",
  "skuProveedor",
  "skuInterno",
  "descripcion",
  "seccion",
  "precioNeto",
  "precioConIva",
  "alicuotaIva",
  "moneda",
  "unidad",
  "fechaVigencia",
] as const;
export type ProductoSingleEditField = (typeof PRODUCTO_SINGLE_EDIT_FIELDS)[number];

// Campos que puede tocar POST /api/productos/editar-lote (subset más chico:
// excluye identificadores como marca/sku/descripción, ver backend).
export const PRODUCTO_BULK_EDIT_FIELDS = [
  "seccion",
  "precioNeto",
  "precioConIva",
  "alicuotaIva",
  "moneda",
  "unidad",
  "fechaVigencia",
] as const;
export type ProductoBulkEditField = (typeof PRODUCTO_BULK_EDIT_FIELDS)[number];

export const PRODUCTO_FIELD_LABELS: Record<ProductoSingleEditField, string> = {
  marca: "Marca",
  skuProveedor: "SKU proveedor",
  skuInterno: "SKU interno",
  descripcion: "Descripción",
  seccion: "Sección",
  precioNeto: "Precio neto",
  precioConIva: "Precio c/IVA",
  alicuotaIva: "IVA %",
  moneda: "Moneda",
  unidad: "Unidad",
  fechaVigencia: "Vigencia",
};

export const PRODUCTO_NUMERIC_FIELDS = new Set<string>([
  "precioNeto",
  "precioConIva",
  "alicuotaIva",
]);
