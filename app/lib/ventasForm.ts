// Estado y validación del formulario de una venta. Los números se guardan como
// TEXTO crudo (lo que tipeó el usuario) y se convierten a number recién al
// armar el pedido: si se guardaran ya convertidos, "1," o "1,5" perderían el
// separador mientras se escribe, y un valor inválido se coaccionaría en
// silencio. Esta capa NUNCA calcula importes: solo valida que lo tipeado sea
// un número aceptable para el backend; los totales salen de la vista previa.

import type { ItemEntrada } from "@/app/lib/facturacion";

// Topes del backend (routes/validar.ts y routes/ventasEntrada.ts). Se validan
// acá solo para dar el mensaje al lado del campo; el backend los vuelve a
// validar siempre.
export const MAX_ITEMS_VENTA = 200;
export const MAX_DESCRIPCION = 500;
const LIMITE_CANTIDAD = 1e9;
const LIMITE_PRECIO = 1e11;

// Alícuotas de IVA que acepta el backend (catalogo.ts, ALICUOTAS).
export const ALICUOTAS_IVA = [0, 2.5, 5, 10.5, 21, 27] as const;
export const ALICUOTA_POR_DEFECTO = 21;

export function etiquetaAlicuota(porcentaje: number): string {
  return `${String(porcentaje).replace(".", ",")} %`;
}

export type ItemFormulario = {
  /** Identidad estable de la fila (no es el índice): ver ItemsEditor. */
  clave: string;
  descripcion: string;
  /** Texto crudo, admite coma o punto decimal. */
  cantidad: string;
  /** Texto crudo, admite coma o punto decimal. */
  precioUnitario: string;
  /** Porcentaje como texto: es el valor del <Select>. */
  alicuotaIva: string;
  productoPrecioId: number | null;
};

// randomUUID solo existe en contextos seguros (https o localhost). Si la app se
// sirviera por http plano no puede romperse el alta de ítems ni la facturación:
// se cae a getRandomValues, que sí está siempre. Sirve tanto de clave de fila
// como de claveIdempotencia (el backend pide entre 8 y 100 caracteres).
export function nuevaClave(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function itemVacio(): ItemFormulario {
  return {
    clave: nuevaClave(),
    descripcion: "",
    cantidad: "1",
    precioUnitario: "",
    alicuotaIva: String(ALICUOTA_POR_DEFECTO),
    productoPrecioId: null,
  };
}

// number -> texto para un input (coma decimal, como se escribe en es-AR).
export function numeroATexto(n: number): string {
  // String(1e-7) da notación científica, que el parser no acepta.
  const texto = String(n).includes("e") ? n.toFixed(4) : String(n);
  return texto.replace(".", ",");
}

type Parseo =
  | { tipo: "vacio" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "ok"; valor: number; decimales: number };

// Acepta "1234", "1234,56", "1234.56" y "12," (separador al final mientras se
// tipea). Rechaza —en vez de adivinar— todo lo ambiguo: "1.234,56" o "1,234.56"
// (separador de miles) y "1.2.3". Un usuario de es-AR que escribe "1.234" para
// mil doscientos treinta y cuatro obtiene 1,234: el resumen de la derecha
// muestra el importe real calculado por el backend para detectarlo.
function parsearDecimal(texto: string): Parseo {
  const limpio = texto.trim();
  if (limpio === "") return { tipo: "vacio" };
  if (limpio.startsWith("-")) return { tipo: "error", mensaje: "No puede ser negativo." };
  const m = /^(\d*)(?:[.,](\d*))?$/.exec(limpio);
  if (!m || (m[1] === "" && !m[2])) {
    return {
      tipo: "error",
      mensaje: "Escribí solo números, con coma o punto para los decimales y sin separador de miles (ej. 1234,56).",
    };
  }
  const entera = m[1] || "0";
  const fraccion = (m[2] ?? "").replace(/0+$/, "");
  const valor = Number(fraccion ? `${entera}.${fraccion}` : entera);
  return { tipo: "ok", valor, decimales: fraccion.length };
}

export type CampoNumerico = { valor: number | null; error: string | null };

export function validarCantidad(texto: string): CampoNumerico {
  const p = parsearDecimal(texto);
  if (p.tipo === "vacio") return { valor: null, error: null };
  if (p.tipo === "error") return { valor: null, error: p.mensaje };
  if (p.valor <= 0) return { valor: null, error: "La cantidad debe ser mayor a 0." };
  if (p.decimales > 3) return { valor: null, error: "La cantidad admite hasta 3 decimales." };
  if (p.valor >= LIMITE_CANTIDAD) return { valor: null, error: "La cantidad debe ser menor a 1.000.000.000." };
  return { valor: p.valor, error: null };
}

export function validarPrecio(texto: string): CampoNumerico {
  const p = parsearDecimal(texto);
  if (p.tipo === "vacio") return { valor: null, error: null };
  if (p.tipo === "error") return { valor: null, error: p.mensaje };
  if (p.decimales > 4) return { valor: null, error: "El precio admite hasta 4 decimales." };
  if (p.valor >= LIMITE_PRECIO) return { valor: null, error: "El precio debe ser menor a 100.000.000.000." };
  return { valor: p.valor, error: null };
}

export type EvaluacionItem = {
  errorCantidad: string | null;
  errorPrecio: string | null;
  /** Falta algún dato (cantidad, precio o descripción) sin que haya un error de formato. */
  incompleto: boolean;
  cantidad: number | null;
  precioUnitario: number | null;
  descripcion: string;
};

export function evaluarItem(item: ItemFormulario): EvaluacionItem {
  const c = validarCantidad(item.cantidad);
  const p = validarPrecio(item.precioUnitario);
  const descripcion = item.descripcion.trim();
  return {
    errorCantidad: c.error,
    errorPrecio: p.error,
    incompleto: c.valor === null || p.valor === null || descripcion === "",
    cantidad: c.valor,
    precioUnitario: p.valor,
    descripcion,
  };
}

// Ítems para POST /api/ventas/previsualizar: alcanza con cantidad y precio
// válidos (la vista previa no pide descripción). null si alguna fila no se
// puede interpretar todavía; no hay vista previa sobre datos a medias.
export function itemsParaPrevisualizar(items: ItemFormulario[]): ItemEntrada[] | null {
  if (items.length === 0) return null;
  const salida: ItemEntrada[] = [];
  for (const item of items) {
    const e = evaluarItem(item);
    if (e.cantidad === null || e.precioUnitario === null) return null;
    salida.push({
      cantidad: e.cantidad,
      precioUnitario: e.precioUnitario,
      alicuotaIva: Number(item.alicuotaIva),
    });
  }
  return salida;
}

// Ítems para POST /api/ventas: además exige descripción en todas las filas.
export function itemsParaGuardar(items: ItemFormulario[]): ItemEntrada[] | null {
  if (items.length === 0 || items.length > MAX_ITEMS_VENTA) return null;
  const salida: ItemEntrada[] = [];
  for (const item of items) {
    const e = evaluarItem(item);
    if (e.cantidad === null || e.precioUnitario === null || e.descripcion === "") return null;
    salida.push({
      descripcion: e.descripcion,
      cantidad: e.cantidad,
      precioUnitario: e.precioUnitario,
      alicuotaIva: Number(item.alicuotaIva),
      productoPrecioId: item.productoPrecioId,
    });
  }
  return salida;
}
