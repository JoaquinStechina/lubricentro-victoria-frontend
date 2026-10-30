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

// Qué precio del catálogo se usó para precargar una fila (null si la fila se
// armó a mano o el usuario tocó el precio después).
export type OrigenPrecio = "neto" | "conIva" | "ninguno";

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
  /** De dónde salió el precio precargado; se limpia si el usuario edita el precio. */
  origenPrecio: OrigenPrecio | null;
  /** Avisos de la precarga que no cambian con la tilde de IVA (moneda, alícuota ajustada, sin precio). */
  avisosCatalogo: string[];
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
    origenPrecio: null,
    avisosCatalogo: [],
  };
}

// number -> texto para un input (coma decimal, como se escribe en es-AR).
export function numeroATexto(n: number): string {
  // Se redondea a 4 decimales (el máximo del precio): un precio con ruido de
  // coma flotante (0.30000000000000004) llegaría al input como un valor que el
  // propio validador rechaza por tener demasiados decimales.
  const redondeado = Number(n.toFixed(4));
  // String(1e-7) da notación científica, que el parser no acepta.
  const texto = String(redondeado).includes("e") ? redondeado.toFixed(4) : String(redondeado);
  return texto.replace(".", ",");
}

type Parseo =
  | { tipo: "vacio" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "ok"; valor: number; decimales: number };

// Acepta "1234", "1234,56", "1234.56", ",5" y "12," (separador al final
// mientras se tipea). Rechaza —en vez de adivinar— todo lo ambiguo:
//  - "1.234" / "12.500": un solo punto seguido de exactamente 3 dígitos puede
//    ser separador de miles (es-AR: mil doscientos treinta y cuatro) o decimal
//    (1,234). Elegir en silencio convertiría un precio de $12.500 en $12,50.
//  - "1.234,56" / "1,234.56" / "1.2.3": mezcla de separadores.
// "1234.5" y "1234.56" (1, 2 o 4+ dígitos tras el punto) no son ambiguos.
function parsearDecimal(texto: string): Parseo {
  const limpio = texto.trim();
  if (limpio === "") return { tipo: "vacio" };
  if (limpio.startsWith("-")) return { tipo: "error", mensaje: "No puede ser negativo." };
  if (/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(limpio)) {
    const sinPuntos = limpio.replace(/\./g, "");
    // Con más de un punto solo puede ser separador de miles (1.234.567).
    if (limpio.split(".").length > 2) {
      return {
        tipo: "error",
        mensaje: `Escribí el número sin puntos de miles (ej. ${sinPuntos}); para decimales usá la coma.`,
      };
    }
    const comoDecimal = limpio.replace(".", ",");
    return {
      tipo: "error",
      mensaje: `Es ambiguo: ¿${sinPuntos} o ${comoDecimal}? Escribí ${sinPuntos} si el punto es separador de miles, o ${comoDecimal} si es decimal.`,
    };
  }
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

// Exportado para poder probar el parser en aislamiento (no hay runner de tests en el repo).
export { parsearDecimal };

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
