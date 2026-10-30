"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import EstadoArcaBanner from "@/app/components/facturacion/EstadoArcaBanner";
import FacturacionNav from "@/app/components/facturacion/FacturacionNav";
import ThemeToggle from "@/app/components/ThemeToggle";
import { ErrorApi, fetchFacturacion, jsonInit, type ConfigFiscal } from "@/app/lib/facturacion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Carga =
  | { estado: "cargando" }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; config: ConfigFiscal | null };

export default function DatosFiscalesPage() {
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  // Cada reintento incrementa el contador y vuelve a disparar el efecto; el
  // estado "cargando" se pone en el manejador del clic, nunca dentro del efecto.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let active = true;
    fetchFacturacion<ConfigFiscal | null>("/api/facturacion/config")
      .then((res) => {
        if (active) setCarga({ estado: "listo", config: res.data });
      })
      .catch((err: unknown) => {
        if (active) {
          setCarga({
            estado: "error",
            mensaje: err instanceof Error ? err.message : "No se pudieron cargar los datos fiscales.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [intento]);

  function reintentar() {
    setCarga({ estado: "cargando" });
    setIntento((n) => n + 1);
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-foreground dark:text-zinc-400"
            >
              <ArrowLeftIcon className="size-3.5" />
              Catálogo
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Datos fiscales
            </h1>
          </div>
          <ThemeToggle />
        </header>

        <FacturacionNav />
        <EstadoArcaBanner />

        {carga.estado === "cargando" && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando datos fiscales…</p>
        )}
        {carga.estado === "error" && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {carga.mensaje}
            </p>
            <Button variant="outline" onClick={reintentar}>
              Reintentar
            </Button>
          </div>
        )}
        {/* El formulario se monta recién con la fila ya cargada: así inicializa
            su estado con useState(valores iniciales) y no hace falta copiar
            props a estado desde un efecto. */}
        {carga.estado === "listo" && <ConfigForm config={carga.config} />}
      </main>
    </div>
  );
}

type Valores = {
  razonSocial: string;
  domicilioComercial: string;
  ingresosBrutos: string;
  inicioActividades: string;
  ptoVta: string;
};

function valoresDe(config: ConfigFiscal | null): Valores {
  return {
    razonSocial: config?.razonSocial ?? "",
    domicilioComercial: config?.domicilioComercial ?? "",
    ingresosBrutos: config?.ingresosBrutos ?? "",
    inicioActividades: config?.inicioActividades ?? "",
    ptoVta: config ? String(config.ptoVta) : "",
  };
}

type ErrorForm = { mensaje: string; detalles: string[] };

function ConfigForm({ config }: { config: ConfigFiscal | null }) {
  const [valores, setValores] = useState<Valores>(() => valoresDe(config));
  const [guardada, setGuardada] = useState(config !== null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ErrorForm | null>(null);
  const [exito, setExito] = useState(false);

  function setCampo(campo: keyof Valores, valor: string) {
    setValores((prev) => ({ ...prev, [campo]: valor }));
    setExito(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setExito(false);
    setGuardando(true);
    // PUT reemplaza la fila entera: se mandan todos los campos y lo opcional
    // vacío va como null (el backend lo guarda como null). Los obligatorios
    // vacíos también se mandan tal cual: la validación y su mensaje son del
    // backend, que es la fuente de verdad.
    const vacioANull = (v: string) => (v.trim() === "" ? null : v.trim());
    try {
      const res = await fetchFacturacion<ConfigFiscal>(
        "/api/facturacion/config",
        jsonInit(
          {
            razonSocial: vacioANull(valores.razonSocial),
            condicionIva: "RI",
            domicilioComercial: vacioANull(valores.domicilioComercial),
            ingresosBrutos: vacioANull(valores.ingresosBrutos),
            inicioActividades: vacioANull(valores.inicioActividades),
            ptoVta: valores.ptoVta.trim() === "" ? null : Number(valores.ptoVta),
          },
          "PUT",
        ),
      );
      // Se muestran los valores tal como quedaron guardados (recortados).
      setValores(valoresDe(res.data));
      setGuardada(true);
      setExito(true);
    } catch (err) {
      // Lo tipeado no se toca: el usuario corrige y reintenta.
      setError(
        err instanceof ErrorApi
          ? { mensaje: err.error, detalles: err.detalles }
          : { mensaje: "No se pudieron guardar los datos fiscales.", detalles: [] },
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {guardada
          ? "Estos datos se imprimen como emisor en cada comprobante."
          : "Todavía no cargaste los datos fiscales: son necesarios para facturar."}{" "}
        El CUIT y el certificado de ARCA se configuran en el servidor, no desde acá.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="razonSocial">Razón social *</Label>
        <Input
          id="razonSocial"
          value={valores.razonSocial}
          onChange={(e) => setCampo("razonSocial", e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="domicilioComercial">Domicilio comercial *</Label>
        <Input
          id="domicilioComercial"
          value={valores.domicilioComercial}
          onChange={(e) => setCampo("domicilioComercial", e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ptoVta">Punto de venta *</Label>
          <Input
            id="ptoVta"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={valores.ptoVta}
            onChange={(e) => setCampo("ptoVta", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ingresosBrutos">Ingresos brutos</Label>
          <Input
            id="ingresosBrutos"
            value={valores.ingresosBrutos}
            onChange={(e) => setCampo("ingresosBrutos", e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inicioActividades">Inicio de actividades</Label>
          <Input
            id="inicioActividades"
            type="date"
            value={valores.inicioActividades}
            onChange={(e) => setCampo("inicioActividades", e.target.value)}
            className="dark:scheme-dark"
          />
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Condición frente al IVA del emisor: Responsable Inscripto (por ahora es la única que se puede emitir).
      </p>

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
        </div>
      )}
      {exito && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2Icon className="size-4 shrink-0" />
          Datos fiscales guardados.
        </p>
      )}

      <div>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
