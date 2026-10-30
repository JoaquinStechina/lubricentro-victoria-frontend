"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import {
  CONDICIONES_IVA,
  ErrorApi,
  TIPOS_DOC,
  condicionIvaPorId,
  fetchFacturacion,
  jsonInit,
  type Cliente,
  type Paginado,
} from "@/app/lib/facturacion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Items de los <Select>: el valor es el id como string (Base UI trabaja con
// strings) y la etiqueta es lo que se muestra en el trigger.
const ITEMS_TIPO_DOC = Object.fromEntries(TIPOS_DOC.map((t) => [String(t.id), t.nombre]));
const ITEMS_CONDICION_IVA = Object.fromEntries(CONDICIONES_IVA.map((c) => [String(c.id), c.nombre]));

// Mismos límites que el backend (MAX_TEXTO y MAX_TEXTO_LARGO en validar.ts):
// con maxLength el usuario no puede tipear de más y se evita un 400 evitable.
const MAX_TEXTO = 191;
const MAX_TEXTO_LARGO = 500;

// Alta y edición de un cliente. Se usa de dos maneras:
//  - con `trigger` (un botón): el diálogo maneja su propio estado abierto/cerrado;
//  - controlado, con `open` y `onOpenChange` (p. ej. "Editar" desde una fila).
// `onGuardado` recibe el cliente guardado. Solo viene sin cliente en un caso
// raro: se restauró uno eliminado y no se pudo traer su ficha; igual hay que
// refrescar la lista del que llama.
export default function ClienteDialog({
  cliente,
  onGuardado,
  trigger,
  open,
  onOpenChange,
}: {
  cliente: Cliente | null;
  onGuardado: (cliente?: Cliente) => void;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const abierto = open ?? abiertoInterno;

  function cambiarAbierto(siguiente: boolean) {
    setAbiertoInterno(siguiente);
    onOpenChange?.(siguiente);
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-lg">
        {/* El formulario vive DENTRO del contenido, que se desmonta al cerrar:
            así cada apertura arranca con los valores del cliente (o vacío) sin
            copiar props a estado desde un efecto. */}
        <ClienteForm
          cliente={cliente}
          onCancelar={() => cambiarAbierto(false)}
          onGuardado={(guardado) => {
            onGuardado(guardado);
            cambiarAbierto(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

type Valores = {
  tipoDoc: string;
  nroDoc: string;
  nombre: string;
  condicionIvaId: string;
  domicilio: string;
  email: string;
};

function valoresIniciales(cliente: Cliente | null): Valores {
  if (!cliente) {
    // Lo más común en un lubricentro: persona con DNI, consumidor final.
    return { tipoDoc: "96", nroDoc: "", nombre: "", condicionIvaId: "5", domicilio: "", email: "" };
  }
  return {
    tipoDoc: String(cliente.tipoDoc),
    nroDoc: cliente.nroDoc,
    nombre: cliente.nombre,
    condicionIvaId: String(cliente.condicionIvaId),
    domicilio: cliente.domicilio ?? "",
    email: cliente.email ?? "",
  };
}

type ErrorForm = { mensaje: string; detalles: string[]; idEliminado: number | null };

function ClienteForm({
  cliente,
  onCancelar,
  onGuardado,
}: {
  cliente: Cliente | null;
  onCancelar: () => void;
  onGuardado: (cliente?: Cliente) => void;
}) {
  const [valores, setValores] = useState<Valores>(() => valoresIniciales(cliente));
  const [error, setError] = useState<ErrorForm | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const ocupado = guardando || restaurando;
  // Ids de los campos: la edición y el alta no coexisten, pero sí pueden
  // convivir con otro diálogo de la pantalla que reutilice los mismos nombres.
  const pref = cliente ? `cliente-${cliente.id}` : "cliente-nuevo";

  function setCampo(campo: keyof Valores, valor: string) {
    setValores((prev) => ({ ...prev, [campo]: valor }));
  }

  const condicion = condicionIvaPorId(Number(valores.condicionIvaId));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setGuardando(true);
    // Los vacíos se mandan tal cual: el mensaje de validación es del backend,
    // la fuente de verdad. Domicilio y email opcionales van como null.
    const cuerpo = {
      tipoDoc: Number(valores.tipoDoc),
      nroDoc: valores.nroDoc.trim(),
      nombre: valores.nombre.trim(),
      condicionIvaId: Number(valores.condicionIvaId),
      domicilio: valores.domicilio.trim() || null,
      email: valores.email.trim() || null,
    };
    try {
      const res = cliente
        ? await fetchFacturacion<Cliente>(`/api/clientes/${cliente.id}`, jsonInit(cuerpo, "PATCH"))
        : await fetchFacturacion<Cliente>("/api/clientes", jsonInit(cuerpo, "POST"));
      onGuardado(res.data);
    } catch (err) {
      // El diálogo sigue abierto y lo tipeado no se toca: se corrige y se reintenta.
      setError(
        err instanceof ErrorApi
          ? { mensaje: err.error, detalles: err.detalles, idEliminado: err.idEliminado }
          : { mensaje: "No se pudo guardar el cliente.", detalles: [], idEliminado: null },
      );
    } finally {
      setGuardando(false);
    }
  }

  // Salida del 409 "ya existe un cliente eliminado con ese documento": el
  // documento es único incluso entre eliminados, así que la única forma de
  // usarlo es restaurar ese cliente.
  async function restaurarExistente(idEliminado: number) {
    setError(null);
    setRestaurando(true);
    try {
      await fetchFacturacion<{ restaurados: number }>(
        "/api/clientes/restaurar",
        jsonInit({ ids: [idEliminado] }, "POST"),
      );
    } catch (err) {
      setError({
        mensaje: err instanceof ErrorApi ? err.error : "No se pudo restaurar el cliente.",
        detalles: err instanceof ErrorApi ? err.detalles : [],
        idEliminado,
      });
      setRestaurando(false);
      return;
    }
    // Ya está restaurado. Se intenta traer su ficha para devolverla (no hay
    // GET por id: se busca por documento); si falla, igual se avisa para que la
    // lista de quien llama se refresque.
    let restaurado: Cliente | undefined;
    try {
      const params = new URLSearchParams({ search: valores.nroDoc.replace(/\D/g, ""), pageSize: "20" });
      const lista = await fetchFacturacion<Paginado<Cliente>>(`/api/clientes?${params.toString()}`);
      restaurado = lista.data.items.find((c) => c.id === idEliminado);
    } catch {
      restaurado = undefined;
    }
    setRestaurando(false);
    onGuardado(restaurado);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{cliente ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        <DialogDescription>
          {cliente
            ? "Los comprobantes ya emitidos conservan los datos del momento de la emisión."
            : "Alta de un cliente para facturarle. Si no hay cliente se factura a Consumidor Final."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${pref}-tipoDoc`}>Tipo de documento</Label>
          <Select
            items={ITEMS_TIPO_DOC}
            value={valores.tipoDoc}
            onValueChange={(v) => v && setCampo("tipoDoc", v)}
          >
            <SelectTrigger id={`${pref}-tipoDoc`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOC.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor={`${pref}-nroDoc`}>Número de documento</Label>
          <Input
            id={`${pref}-nroDoc`}
            value={valores.nroDoc}
            onChange={(e) => setCampo("nroDoc", e.target.value)}
            placeholder={valores.tipoDoc === "96" ? "12345678" : "30-12345678-9"}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${pref}-nombre`}>Nombre o razón social</Label>
        <Input
          id={`${pref}-nombre`}
          value={valores.nombre}
          onChange={(e) => setCampo("nombre", e.target.value)}
          maxLength={MAX_TEXTO}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${pref}-condicionIva`}>Condición frente al IVA</Label>
        <Select
          items={ITEMS_CONDICION_IVA}
          value={valores.condicionIvaId}
          onValueChange={(v) => v && setCampo("condicionIvaId", v)}
        >
          <SelectTrigger id={`${pref}-condicionIva`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDICIONES_IVA.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Aviso en vivo de la clase que resulta. Es solo orientativo: el
            backend decide la clase real al previsualizar y emitir. */}
        {condicion && (
          <p role="status" className="text-xs text-zinc-600 dark:text-zinc-400">
            Se le emitirá{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Factura {condicion.clase}</span>.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${pref}-domicilio`}>Domicilio (opcional)</Label>
        <Input
          id={`${pref}-domicilio`}
          value={valores.domicilio}
          onChange={(e) => setCampo("domicilio", e.target.value)}
          maxLength={MAX_TEXTO_LARGO}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${pref}-email`}>Email (opcional)</Label>
        <Input
          id={`${pref}-email`}
          type="email"
          value={valores.email}
          onChange={(e) => setCampo("email", e.target.value)}
          maxLength={MAX_TEXTO}
          autoComplete="off"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          <p className="font-medium">{error.mensaje}</p>
          {error.detalles.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {error.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          {error.idEliminado !== null && (
            <div className="mt-2 flex flex-col items-start gap-2">
              <p>
                Para usar ese documento tenés que restaurar el cliente eliminado; se recupera con los datos que tenía
                antes (después podés editarlo).
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={ocupado}
                onClick={() => restaurarExistente(error.idEliminado as number)}
              >
                {restaurando ? "Restaurando…" : "Restaurar ese cliente"}
              </Button>
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </Button>
        <Button type="submit" disabled={ocupado}>
          {guardando ? "Guardando…" : cliente ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </DialogFooter>
    </form>
  );
}
