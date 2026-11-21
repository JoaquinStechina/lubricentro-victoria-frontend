"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";
import ListaEquivalencias from "@/app/components/equivalencias/ListaEquivalencias";
import {
  agregarEquivalencia,
  borrarEquivalencia,
  buscarEquivalencias,
  descartarResultado,
  esCodigoBuscable,
  estadoEquivalencias,
  listarDescartes,
  listarManuales,
  recalcularEquivalencias,
  restaurarDescarte,
  type DescarteEquivalencia,
  type EstadoEquivalencias,
  type ParEquivalencia,
  type RespuestaBusqueda,
  type ResultadoEquivalencia,
} from "@/app/lib/equivalencias";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado");
const extremo = (marca: string | null, codigo: string) => `${marca ? `${marca} ` : ""}${codigo}`;

function textoHace(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

function Estado({ version, onCambio }: { version: number; onCambio: () => void }) {
  const [estado, setEstado] = useState<EstadoEquivalencias | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);

  useEffect(() => {
    let vigente = true;
    estadoEquivalencias()
      .then((e) => {
        if (!vigente) return;
        setEstado(e);
        setError(null);
      })
      .catch((e) => {
        if (vigente) setError(mensaje(e));
      });
    return () => {
      vigente = false;
    };
  }, [version]);

  async function recalcular() {
    setRecalculando(true);
    try {
      await recalcularEquivalencias();
      setError(null);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setRecalculando(false);
      onCambio();
    }
  }

  return (
    <section className="mb-8 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {estado === null
            ? "Cargando estado…"
            : estado.ultimaActualizacion
              ? `Actualizada ${textoHace(estado.ultimaActualizacion)} · ${estado.pares} equivalencias`
              : `Todavía no se calculó · ${estado.pares} equivalencias`}
          {(recalculando || estado?.corriendo) && " · recalculando…"}
        </p>
        <Button type="button" variant="outline" disabled={recalculando} onClick={recalcular}>
          {recalculando ? "Recalculando…" : "Recalcular ahora"}
        </Button>
      </div>
      {estado?.ultimoError && (
        <p className="mt-2 text-sm text-destructive">Último error: {estado.ultimoError}</p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function Buscador({ version, onCambio }: { version: number; onCambio: () => void }) {
  const [q, setQ] = useState("");
  const [respuesta, setRespuesta] = useState<RespuestaBusqueda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consulta = q.trim();
  const buscable = esCodigoBuscable(consulta);

  useEffect(() => {
    if (!buscable) return;
    const controller = new AbortController();
    const id = setTimeout(() => {
      buscarEquivalencias(consulta, controller.signal)
        .then((r) => {
          setRespuesta({ ...r, q: consulta });
          setError(null);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          setRespuesta(null);
          setError(mensaje(e));
        });
    }, 300);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [consulta, buscable, version]);

  async function descartar(r: ResultadoEquivalencia) {
    try {
      await descartarResultado(r);
      setError(null);
    } catch (e) {
      setError(mensaje(e));
    }
    onCambio();
  }

  const vigente = buscable && respuesta?.q === consulta ? respuesta : null;

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">Buscar</h2>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Código, por ejemplo HU 947/1"
        className="max-w-sm"
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {vigente && (
        <div className="mt-3">
          {vigente.productosBuscados.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ningún producto del catálogo tiene el código {consulta}
            </p>
          )}
          <ListaEquivalencias q={consulta} resultado={vigente.equivalencias} onDescartar={descartar} />
          {vigente.equivalencias.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin equivalencias.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Agregar({ codigoInicial, onCambio }: { codigoInicial: string; onCambio: () => void }) {
  const [marcaA, setMarcaA] = useState("");
  const [codigoA, setCodigoA] = useState(codigoInicial);
  const [marcaB, setMarcaB] = useState("");
  const [codigoB, setCodigoB] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setOk(false);
    try {
      await agregarEquivalencia({ marca: marcaA, codigo: codigoA }, { marca: marcaB, codigo: codigoB });
      setError(null);
      setOk(true);
      setMarcaA("");
      setCodigoA("");
      setMarcaB("");
      setCodigoB("");
      onCambio();
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">Agregar equivalencia</h2>
      <form onSubmit={guardar} className="flex flex-wrap items-center gap-2">
        <Input className="w-36" value={marcaA} onChange={(e) => setMarcaA(e.target.value)} placeholder="Marca A" aria-label="Marca A" />
        <Input className="w-44" value={codigoA} onChange={(e) => setCodigoA(e.target.value)} placeholder="Código A" aria-label="Código A" required />
        <span className="text-lg text-muted-foreground">≡</span>
        <Input className="w-36" value={marcaB} onChange={(e) => setMarcaB(e.target.value)} placeholder="Marca B" aria-label="Marca B" />
        <Input className="w-44" value={codigoB} onChange={(e) => setCodigoB(e.target.value)} placeholder="Código B" aria-label="Código B" required />
        <Button type="submit" disabled={guardando}>
          {guardando ? "Agregando…" : "Agregar"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {ok && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">Equivalencia agregada.</p>}
    </section>
  );
}

// Lee `?agregar=` (lo manda el pie de la ventana Ctrl + K). Va aparte para que
// el Suspense que pide useSearchParams no cubra toda la página.
function AgregarConPrefill({ onCambio }: { onCambio: () => void }) {
  const agregar = useSearchParams().get("agregar") ?? "";
  // La key remonta el formulario si cambia ?agregar=.
  return <Agregar key={agregar} codigoInicial={agregar} onCambio={onCambio} />;
}

function TablaPares({
  filas,
  accion,
  onAccion,
}: {
  filas: { id: number; texto: string }[];
  accion: string;
  onAccion: (id: number) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Equivalencia</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((f) => (
          <TableRow key={f.id}>
            <TableCell>{f.texto}</TableCell>
            <TableCell>
              <Button type="button" variant="ghost" size="sm" onClick={() => onAccion(f.id)}>
                {accion}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Listas({ version, onCambio }: { version: number; onCambio: () => void }) {
  const [manuales, setManuales] = useState<ParEquivalencia[]>([]);
  const [descartes, setDescartes] = useState<DescarteEquivalencia[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarManuales(), listarDescartes()])
      .then(([m, d]) => {
        if (!vigente) return;
        setManuales(m);
        setDescartes(d);
        setError(null);
      })
      .catch((e) => {
        if (vigente) setError(mensaje(e));
      });
    return () => {
      vigente = false;
    };
  }, [version]);

  async function accion(fn: () => Promise<void>) {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(mensaje(e));
    }
    onCambio();
  }

  return (
    <>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Agregadas a mano</h2>
        {manuales.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay equivalencias agregadas a mano.</p>
        ) : (
          <TablaPares
            filas={manuales.map((p) => ({
              id: p.id,
              texto: `${extremo(p.marcaA, p.codigoA)} ≡ ${extremo(p.marcaB, p.codigoB)}`,
            }))}
            accion="Borrar"
            onAccion={(id) => accion(() => borrarEquivalencia(id))}
          />
        )}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Descartadas</h2>
        {descartes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay equivalencias descartadas.</p>
        ) : (
          <TablaPares
            filas={descartes.map((d) => ({
              id: d.id,
              texto: `${extremo(d.marcaA, d.codigoA)} ≡ ${extremo(d.marcaB, d.codigoB)}`,
            }))}
            accion="Restaurar"
            onAccion={(id) => accion(() => restaurarDescarte(id))}
          />
        )}
      </section>
    </>
  );
}

export default function EquivalenciasPage() {
  // Se incrementa ante cualquier cambio (descartar, agregar, borrar, restaurar, recalcular) y refresca estado, búsqueda y listas.
  const [version, setVersion] = useState(0);
  const cambio = useCallback(() => setVersion((v) => v + 1), []);

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
              Equivalencias
            </h1>
          </div>
          <ThemeToggle />
        </header>

        <Estado version={version} onCambio={cambio} />
        <Buscador version={version} onCambio={cambio} />
        <Suspense fallback={null}>
          <AgregarConPrefill onCambio={cambio} />
        </Suspense>
        <Listas version={version} onCambio={cambio} />
      </main>
    </div>
  );
}
