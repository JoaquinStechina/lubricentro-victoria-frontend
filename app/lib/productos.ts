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
  precioLista: number | null;
  precioListaConIva: number | null;
  precioSugerido: number | null;
  alicuotaIva: number | null;
  moneda: string;
  unidad: string | null;
  fechaVigencia: string | null;
  imagenUrl: string | null;
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
  | "skuProveedor"
  | "descripcion"
  | "seccion"
  | "precioNetoMin"
  | "precioNetoMax"
  | "precioConIvaMin"
  | "precioConIvaMax"
  | "precioListaMin"
  | "precioListaMax"
  | "precioListaConIvaMin"
  | "precioListaConIvaMax"
  | "precioSugeridoMin"
  | "precioSugeridoMax"
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
  "precioLista",
  "precioListaConIva",
  "precioSugerido",
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
  "precioLista",
  "precioListaConIva",
  "precioSugerido",
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
  precioConIva: "Precio Neto C/IVA",
  precioLista: "Precio Lista",
  precioListaConIva: "Precio Lista C/IVA",
  precioSugerido: "Precio Sugerido",
  alicuotaIva: "IVA %",
  moneda: "Moneda",
  unidad: "Unidad",
  fechaVigencia: "Vigencia",
};

export const PRODUCTO_NUMERIC_FIELDS = new Set<string>([
  "precioNeto",
  "precioConIva",
  "precioLista",
  "precioListaConIva",
  "precioSugerido",
  "alicuotaIva",
]);

// Redondeo a 2 decimales: evita que el resultado arrastre el error de coma
// flotante de JS (ej. 333.33 * 17.5 / 100 = 58.332750000000004) — mismo
// criterio que ReviewTable.tsx usa al calcular estos mismos campos durante
// la revisión de una carga.
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// "Precio Neto C/IVA" / "Precio Lista C/IVA" a partir de un precio base
// (neto o lista) + alícuota — misma fórmula en los dos casos, para que un
// producto cargado a mano dé el mismo resultado que uno cargado por
// archivo (ver ReviewTable.tsx). null si falta cualquiera de los dos datos
// (no inventa un valor con solo la mitad de la cuenta).
export function calcularPrecioConIva(precioBase: number, alicuotaIva: number): number | null {
  if (!Number.isFinite(precioBase) || !Number.isFinite(alicuotaIva)) return null;
  return round2(precioBase + (precioBase * alicuotaIva) / 100);
}

// Precio Sugerido = Precio Neto C/IVA + % de ganancia. El % de ganancia no
// es un campo del producto (no se persiste): es un dato auxiliar que solo
// existe mientras se completa el formulario, igual que en ReviewTable.tsx.
export function calcularPrecioSugerido(precioConIva: number, porcentajeGanancia: number): number | null {
  if (!Number.isFinite(precioConIva) || !Number.isFinite(porcentajeGanancia)) return null;
  return round2(precioConIva + (precioConIva * porcentajeGanancia) / 100);
}
