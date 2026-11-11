// Tipos, formateadores y cliente HTTP del módulo de facturación electrónica
// (ARCA). Los tipos reflejan el JSON REAL del backend (repo hermano
// `backend/`: routes/facturacion.ts, comprobantesSalida.ts, ventas.ts,
// clientes.ts). No hay paquete compartido entre los dos repos, así que es una
// copia deliberada, igual que app/lib/cargas.ts: si el backend cambia una
// forma, hay que actualizarla acá.
//
// Los importes llegan como NÚMEROS (el backend convierte los Decimal) y esta
// capa nunca calcula totales ni IVA: la única fuente de cálculo es
// POST /api/ventas/previsualizar.

import { API_URL } from "@/app/lib/api";

// ---------------------------------------------------------------------------
// Catálogo fiscal
// ---------------------------------------------------------------------------

// Condiciones frente al IVA del receptor (ids de ARCA) y la clase de factura
// que le corresponde. Copia deliberada de CONDICION_IVA y de las reglas
// CLASE_A / CLASE_B de backend/src/facturacion/catalogo.ts (los nombres son
// solo de presentación). El backend es quien decide la clase real al
// previsualizar y emitir; esto sirve para armar selects y mostrar nombres.
export const CONDICIONES_IVA: { id: number; nombre: string; clase: "A" | "B" }[] = [
  { id: 1, nombre: "Responsable Inscripto", clase: "A" },
  { id: 4, nombre: "Exento", clase: "B" },
  { id: 5, nombre: "Consumidor Final", clase: "B" },
  { id: 6, nombre: "Responsable Monotributo", clase: "A" },
  { id: 7, nombre: "Sujeto No Categorizado", clase: "B" },
  { id: 8, nombre: "Proveedor del Exterior", clase: "B" },
  { id: 9, nombre: "Cliente del Exterior", clase: "B" },
  { id: 10, nombre: "IVA Liberado", clase: "B" },
  { id: 13, nombre: "Monotributista Social", clase: "A" },
  { id: 15, nombre: "IVA No Alcanzado", clase: "B" },
  { id: 16, nombre: "Monotributo Trabajador Independiente Promovido", clase: "A" },
];

// Códigos de comprobante de ARCA que emite el sistema (solo clases A y B).
const TIPOS: Record<number, string> = {
  1: "Factura A",
  2: "Nota de débito A",
  3: "Nota de crédito A",
  6: "Factura B",
  7: "Nota de débito B",
  8: "Nota de crédito B",
};

// ---------------------------------------------------------------------------
// Tipos del JSON del backend
// ---------------------------------------------------------------------------

export type Paginado<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type Ambiente = "simulado" | "homologacion" | "produccion";

// GET /api/facturacion/estado. `ambiente` es null cuando la config de ARCA
// (variables de entorno) es inválida o falta.
export type EstadoArca = {
  configurado: boolean;
  ambiente: Ambiente | null;
  problemas: string[];
};

// Fila de GET/PUT /api/facturacion/config (es una sola fila, id 1). GET
// devuelve null si nunca se guardó. El CUIT y el certificado no están acá:
// viven en el entorno del backend.
export type ConfigFiscal = {
  id: number;
  razonSocial: string;
  condicionIva: string;
  domicilioComercial: string;
  ingresosBrutos: string | null;
  /** YYYY-MM-DD */
  inicioActividades: string | null;
  ptoVta: number;
  updatedAt: string;
};

// Fila de GET /api/clientes y respuesta de POST/PATCH (el backend devuelve la
// fila de Prisma tal cual).
export type Cliente = {
  id: number;
  /** 80 CUIT, 86 CUIL, 96 DNI */
  tipoDoc: number;
  /** Solo dígitos (el backend normaliza "30-12345678-9"). */
  nroDoc: string;
  nombre: string;
  condicionIvaId: number;
  domicilio: string | null;
  email: string | null;
  eliminado: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VentaItem = {
  id: number;
  ventaId: number;
  orden: number;
  productoPrecioId: number | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  /** Porcentaje: 0, 10.5, 21, 27, 5, 2.5 */
  alicuotaIva: number;
};

export type EstadoFactura = "sin_facturar" | "pendiente" | "facturada" | "con_notas";

type VentaBase = {
  id: number;
  clienteId: number | null;
  cliente: { id: number; nombre: string } | null;
  /** YYYY-MM-DD */
  fecha: string;
  preciosIncluyenIva: boolean;
  condicionVenta: string;
  observaciones: string | null;
  eliminado: boolean;
  createdAt: string;
  updatedAt: string;
};

// Fila de GET /api/ventas (sin ítems). `impTotal` lo calcula el backend y es
// null si esa fila no se pudo calcular.
export type Venta = VentaBase & {
  impTotal: number | null;
  estadoFactura: EstadoFactura;
};

// Resumen de un comprobante dentro del detalle de una venta.
export type ComprobanteDeVenta = {
  id: number;
  tipo: number;
  ptoVta: number;
  nro: number | null;
  estado: EstadoComprobante;
  impTotal: number;
  cae: string | null;
  createdAt: string;
};

// GET /api/ventas/:id y respuesta de POST /api/ventas.
export type VentaDetalle = VentaBase & {
  items: VentaItem[];
  comprobantes: ComprobanteDeVenta[];
};

export type EstadoComprobante = "borrador" | "pendiente" | "autorizado" | "rechazado" | "error";

// Fila de GET /api/facturacion/comprobantes (sin `items` ni `iva`).
export type Comprobante = {
  id: number;
  ventaId: number;
  /** 1, 2, 3, 6, 7, 8 */
  tipo: number;
  ptoVta: number;
  /** null mientras no tiene número y en rechazados/con error. */
  nro: number | null;
  estado: EstadoComprobante;
  ambiente: Ambiente;
  /** YYYY-MM-DD */
  fechaEmision: string;
  preciosIncluyenIva: boolean;
  receptorDocTipo: number;
  receptorDocNro: string;
  receptorNombre: string;
  receptorCondicionIvaId: number;
  receptorDomicilio: string | null;
  impNeto: number;
  impIva: number;
  impTotal: number;
  cae: string | null;
  /** YYYY-MM-DD */
  caeVto: string | null;
  /** JSON de ARCA (normalmente [{codigo, mensaje}]); forma no garantizada. */
  observaciones: unknown;
  motivoError: string | null;
  comprobanteAsociadoId: number | null;
  createdAt: string;
  updatedAt: string;
};

// Línea del snapshot `items` de un comprobante (importes solo para mostrar).
export type ItemComprobante = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  alicuotaIva: number;
  neto: number;
  iva: number;
  total: number;
};

// Desglose de IVA por alícuota (snapshot `iva` y `Previsualizacion.iva`).
export type DesgloseIva = {
  /** Id de alícuota de ARCA. */
  id: number;
  porcentaje: number;
  baseImp: number;
  importe: number;
};

// Respuesta de POST /comprobantes (201/202/200), de /notas y de /reconciliar:
// la fila más `items` e `iva`.
export type ComprobanteConItems = Comprobante & {
  items: ItemComprobante[];
  iva: DesgloseIva[];
};

type ReferenciaComprobante = { id: number; tipo: number; ptoVta: number; nro: number | null };

// GET /api/facturacion/comprobantes/:id
export type ComprobanteDetalle = ComprobanteConItems & {
  venta: { id: number; fecha: string };
  /** La factura que corrige, si es una nota. */
  asociado: ReferenciaComprobante | null;
  /** Las notas que corrigen a este comprobante. */
  notas: (ReferenciaComprobante & { estado: EstadoComprobante; impTotal: number })[];
};

// Ítem que se manda al backend (previsualizar, crear venta, notas parciales).
// `descripcion` es opcional solo en la vista previa; la venta y las notas la
// exigen. `productoPrecioId` lo usa la venta y las notas lo descartan.
export type ItemEntrada = {
  descripcion?: string | null;
  cantidad: number;
  precioUnitario: number;
  alicuotaIva: number;
  productoPrecioId?: number | null;
};

export type LineaCalculada = { neto: number; iva: number; total: number };

// Respuesta de POST /api/ventas/previsualizar. `errores` son frases listas
// para mostrar (p. ej. receptor inválido o ARCA sin configurar).
export type Previsualizacion = {
  lineas: LineaCalculada[];
  impNeto: number;
  impIva: number;
  impTotal: number;
  iva: DesgloseIva[];
  clase: "A" | "B";
  tipoComprobante: number;
  errores: string[];
};

// ---------------------------------------------------------------------------
// Formateadores
// ---------------------------------------------------------------------------

const formatoMoneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

// Un valor no numérico (NaN/Infinity) se muestra como "—": nunca "NaN" en
// pantalla. Un importe que redondea a cero (incluido -0) se muestra sin signo:
// Intl formatea -0 como "-$ 0,00", que en una factura confunde.
export function formatearMoneda(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return formatoMoneda.format(Math.round(n * 100) === 0 ? 0 : n);
}

// Eco de un precio unitario TIPEADO por el usuario: el precio admite hasta 4
// decimales y con formatearMoneda (2) "1,2345" se vería como "$ 1,23". Solo
// para ese eco; los importes del backend siguen mostrándose con formatearMoneda.
const formatoPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatearMonedaPrecio(n: number): string {
  return Number.isFinite(n) ? formatoPrecio.format(n) : "—";
}

// "0001-00000012"; "—" mientras el comprobante no tiene número.
export function formatearNroComprobante(ptoVta: number, nro: number | null): string {
  if (nro === null) return "—";
  return `${String(ptoVta).padStart(4, "0")}-${String(nro).padStart(8, "0")}`;
}

export function etiquetaTipo(tipo: number): string {
  return TIPOS[tipo] ?? `Comprobante ${tipo}`;
}

// Los seis códigos que emite el sistema, en el orden del filtro del listado.
export const TIPOS_COMPROBANTE: number[] = [1, 6, 2, 7, 3, 8];

// Solo un comprobante autorizado que sea factura (1, 6) o nota de débito
// (2, 7) admite notas encima; una nota de crédito (3, 8) no se anula ni se
// corrige con otra nota. El backend vuelve a validarlo.
export function admiteNotas(tipo: number, estado: string): boolean {
  return estado === "autorizado" && (tipo === 1 || tipo === 2 || tipo === 6 || tipo === 7);
}

// Todo ambiente que no sea producción emite comprobantes sin validez fiscal.
export function esAmbienteDePrueba(ambiente: string): boolean {
  return ambiente !== "produccion";
}

const ESTADOS: Record<EstadoComprobante, string> = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
  error: "Con error",
};

export function etiquetaEstado(estado: string): string {
  return ESTADOS[estado as EstadoComprobante] ?? estado;
}

export type VarianteBadge = "default" | "secondary" | "destructive" | "outline";

// Variante de <Badge> por estado. `pendiente` es la incertidumbre con ARCA y
// tiene que destacar: usa el color de énfasis del tema, no el neutro.
export function varianteEstado(estado: string): VarianteBadge {
  switch (estado) {
    case "autorizado":
      return "secondary";
    case "pendiente":
      return "default";
    case "rechazado":
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}

// Tipos de documento del receptor (códigos de ARCA). El backend de clientes
// acepta solo estos tres.
export const TIPOS_DOC: { id: number; nombre: string }[] = [
  { id: 80, nombre: "CUIT" },
  { id: 86, nombre: "CUIL" },
  { id: 96, nombre: "DNI" },
];

export function etiquetaTipoDoc(tipoDoc: number): string {
  return TIPOS_DOC.find((t) => t.id === tipoDoc)?.nombre ?? `Doc. ${tipoDoc}`;
}

// "CUIT 30-12345678-9" / "DNI 12345678". El backend guarda solo dígitos; el
// guionado de CUIT/CUIL es solo de presentación (y solo si tiene 11 dígitos).
export function formatearDocumento(tipoDoc: number, nroDoc: string): string {
  const esCuit = tipoDoc === 80 || tipoDoc === 86;
  const nro =
    esCuit && /^\d{11}$/.test(nroDoc) ? `${nroDoc.slice(0, 2)}-${nroDoc.slice(2, 10)}-${nroDoc.slice(10)}` : nroDoc;
  return `${etiquetaTipoDoc(tipoDoc)} ${nro}`;
}

export function condicionIvaPorId(id: number) {
  return CONDICIONES_IVA.find((c) => c.id === id);
}

const ESTADOS_FACTURA: Record<EstadoFactura, string> = {
  sin_facturar: "Sin facturar",
  pendiente: "Pendiente de ARCA",
  facturada: "Facturada",
  con_notas: "Facturada con notas",
};

export function etiquetaEstadoFactura(estado: EstadoFactura): string {
  return ESTADOS_FACTURA[estado] ?? estado;
}

// "2026-10-30" -> "30/10/2026". Se parte el texto a mano: pasar por Date
// correría el día según la zona horaria del navegador.
export function formatearFechaIso(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

// Las observaciones de ARCA llegan como JSON sin forma garantizada
// (normalmente [{codigo, mensaje}]). Se convierten a frases para mostrar y
// lo que no se entiende se ignora en vez de romper la pantalla.
export function textoObservaciones(observaciones: unknown): string[] {
  if (!Array.isArray(observaciones)) return [];
  const frases: string[] = [];
  for (const o of observaciones) {
    if (typeof o === "string" && o) frases.push(o);
    else if (o && typeof o === "object") {
      const { codigo, mensaje } = o as { codigo?: unknown; mensaje?: unknown };
      if (typeof mensaje === "string" && mensaje) {
        frases.push(codigo !== undefined && codigo !== null ? `${String(codigo)}: ${mensaje}` : mensaje);
      }
    }
  }
  return frases;
}

const AMBIENTES: Record<Ambiente, string> = {
  simulado: "SIMULADO",
  homologacion: "HOMOLOGACIÓN",
  produccion: "PRODUCCIÓN",
};

export function etiquetaAmbiente(ambiente: string): string {
  return AMBIENTES[ambiente as Ambiente] ?? ambiente.toUpperCase();
}

// ---------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------

// Error de una respuesta no exitosa (o de red, con status 0). A diferencia de
// apiFetch, conserva el status y los `detalles` del backend para que la UI
// pueda mostrarlos y distinguir, p. ej., un 409 ("ya no está pendiente", o
// cliente eliminado con `idEliminado`) de una falla real.
export class ErrorApi extends Error {
  readonly status: number;
  /** Mensaje del backend (`error`); es el mismo que `message`. */
  readonly error: string;
  readonly detalles: string[];
  readonly idEliminado: number | null;

  constructor(status: number, error: string, detalles: string[] = [], idEliminado: number | null = null) {
    super(error);
    this.name = "ErrorApi";
    this.status = status;
    this.error = error;
    this.detalles = detalles;
    this.idEliminado = idEliminado;
  }
}

// Marca interna para distinguir "el cuerpo no era JSON" de un `null` legítimo
// (GET /config devuelve null si nunca se guardó).
const INVALIDO = Symbol("cuerpo-no-json");

export type RespuestaApi<T> = { status: number; data: T };

// fetch hacia el backend que devuelve `{ status, data }` en cualquier 2xx (así
// se distingue 201 de 202 y 200) y lanza `ErrorApi` en el resto. No reemplaza a
// apiFetch: ese sigue siendo el cliente del resto de la app.
export async function fetchFacturacion<T>(path: string, init?: RequestInit): Promise<RespuestaApi<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
  }
  // 204 no tiene cuerpo: es un éxito con `data: null`, no un JSON inválido.
  if (res.status === 204) return { status: 204, data: null as T };
  const cuerpo: unknown = await res.json().catch(() => INVALIDO);
  if (!res.ok) {
    const c = (cuerpo && cuerpo !== INVALIDO && typeof cuerpo === "object" ? cuerpo : {}) as {
      error?: unknown;
      detalles?: unknown;
      idEliminado?: unknown;
    };
    throw new ErrorApi(
      res.status,
      // Sin `error` en el cuerpo (p. ej. un 502 de un proxy con HTML) no se
      // muestra el detalle técnico de la ruta: un mensaje genérico en español.
      typeof c.error === "string" && c.error
        ? c.error
        : `El servidor no respondió como se esperaba (código ${res.status}). Probá de nuevo en unos minutos.`,
      Array.isArray(c.detalles) ? c.detalles.filter((d): d is string => typeof d === "string") : [],
      typeof c.idEliminado === "number" ? c.idEliminado : null,
    );
  }
  // Un 2xx con cuerpo que no es JSON no se puede usar como `T`: se trata como
  // falla en vez de devolver `null` disfrazado de dato.
  if (cuerpo === INVALIDO) {
    throw new ErrorApi(
      res.status,
      `El servidor respondió con un formato inesperado (código ${res.status}). Probá de nuevo en unos minutos.`,
    );
  }
  return { status: res.status, data: cuerpo as T };
}

// apiJsonInit (api.ts) solo cubre POST y PATCH; la config fiscal se guarda con PUT.
export function jsonInit(body: unknown, method: "POST" | "PUT" | "PATCH" = "POST"): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
