// Tipos que devuelve el backend en /api/stock — ver backend/src/routes/stock.ts.
// El stock es el inventario propio del lubricentro, distinto del catálogo de
// listas de proveedor (ProductoPrecio): en el estante hay una sola caja con
// una sola cantidad, sin importar cuántos proveedores vendan ese código.

export type ArticuloStock = {
  id: number;
  marca: string;
  codigo: string;
  // UPPER sin espacios/guiones/puntos/barras. Lo calcula el backend; el
  // cliente nunca lo manda ni lo edita. Es la clave con la que se matchean
  // los precios del catálogo.
  codigoNorm: string;
  descripcion: string;
  categoria: string | null;
  ubicacion: string | null;
  cantidad: number;
  // null = el artículo no participa de las alertas de reposición.
  minimo: number | null;
  eliminado: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TipoMovimiento = "entrada" | "salida" | "ajuste";

export type MovimientoStock = {
  id: number;
  articuloId: number;
  tipo: TipoMovimiento;
  // Con signo: entrada positivo, salida negativo, ajuste la diferencia contra
  // lo que había.
  delta: number;
  cantidadResultante: number;
  motivo: string | null;
  createdAt: string;
  // Solo viene en el feed global (GET /api/stock/movimientos), no en el
  // historial de un artículo puntual.
  articulo?: { id: number; marca: string; codigo: string; descripcion: string };
};

export type FilaReposicion = {
  id: number;
  marca: string;
  codigo: string;
  codigoNorm: string;
  descripcion: string;
  cantidad: number;
  minimo: number;
  faltante: number;
  // null = el artículo no está en ninguna lista de proveedor cargada, así que
  // no hay precio de referencia para reponerlo.
  mejorOpcion: { proveedor: string; precio: number } | null;
};

export type StockColumnKey =
  | "marca"
  | "codigo"
  | "descripcion"
  | "categoria"
  | "ubicacion";

export const STOCK_EMPTY_COLUMN_FILTERS: Record<StockColumnKey, string> = {
  marca: "",
  codigo: "",
  descripcion: "",
  categoria: "",
  ubicacion: "",
};

export const TIPO_MOVIMIENTO_LABELS: Record<TipoMovimiento, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

// Un artículo está en alerta cuando tiene mínimo definido y la cantidad ya
// llegó a él. Se usa para el badge en la tabla y para la vista de Reposición.
export function estaBajoMinimo(articulo: { cantidad: number; minimo: number | null }): boolean {
  return articulo.minimo !== null && articulo.cantidad <= articulo.minimo;
}
