"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FilaEquivalencia } from "@/app/components/equivalencias/ListaEquivalencias";
import {
  buscarEquivalencias,
  descartarResultado,
  esCodigoBuscable,
  type ResultadoEquivalencia,
  type RespuestaBusqueda,
} from "@/app/lib/equivalencias";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// El Catálogo con el código buscado. `k` cambia en cada Enter: con el mismo
// código ya en la URL, igual remonta el Catálogo y cambia de pestaña (app/page.tsx).
function urlDelCatalogo(codigo: string): string {
  return `/?search=${encodeURIComponent(codigo)}&k=${Date.now()}`;
}

// Ventana de búsqueda rápida de equivalencias, abierta con Ctrl + K desde cualquier pantalla.
export default function AtajoEquivalencias() {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState("");
  // La respuesta lleva la q que la originó: si q cambia, la anterior no se muestra.
  const [respuesta, setRespuesta] = useState<RespuestaBusqueda | null>(null);
  // Se incrementa para volver a consultar la misma q (después de descartar).
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const consulta = q.trim();
  const buscable = esCodigoBuscable(consulta);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierta(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!abierta || !buscable) return;
    const controller = new AbortController();
    const id = setTimeout(() => {
      buscarEquivalencias(consulta, controller.signal)
        .then((r) => {
          setError(null);
          setRespuesta({ ...r, q: consulta });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setRespuesta(null);
            setError("No se pudo buscar");
          }
        });
    }, 300);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [abierta, consulta, buscable, version]);

  function cambiarAbierta(valor: boolean) {
    setAbierta(valor);
    if (!valor) {
      setQ("");
      setRespuesta(null);
      setError(null);
    }
  }

  function elegir(codigo: string) {
    cambiarAbierta(false);
    router.push(urlDelCatalogo(codigo));
  }

  async function descartar(r: ResultadoEquivalencia) {
    try {
      await descartarResultado(r);
    } catch {
      setError("No se pudo descartar");
      return;
    }
    setVersion((v) => v + 1);
  }

  const vigente = buscable && respuesta?.q === consulta ? respuesta : null;

  return (
    <CommandDialog
      open={abierta}
      onOpenChange={cambiarAbierta}
      title="Buscar equivalencias"
      description="Busca un código y muestra sus equivalencias"
      className="top-1/2 -translate-y-1/2 sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder="Código a buscar (ej. PH4553)"
        />
        <CommandList className="max-h-80">
          {error && (
            <p className="px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          {vigente && vigente.productosBuscados.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Ningún producto del catálogo tiene el código {consulta}
            </p>
          )}
          {vigente && vigente.equivalencias.length > 0 && (
            <CommandGroup heading={`EQUIVALENCIAS DE ${consulta}`}>
              {vigente.equivalencias.map((r) => (
                <CommandItem
                  key={`${r.marcaNorm}|${r.codigoNorm}`}
                  value={`${r.marcaNorm}|${r.codigoNorm}`}
                  onSelect={() => elegir(r.codigo)}
                >
                  <FilaEquivalencia r={r} compacta onDescartar={descartar} />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>↑↓ moverse · Enter ver en el Catálogo · Esc cerrar</span>
          {buscable && (
            <Link
              href={`/equivalencias?agregar=${encodeURIComponent(consulta)}`}
              onClick={() => cambiarAbierta(false)}
              className="font-medium text-foreground hover:underline"
            >
              + Agregar equivalencia para {consulta}
            </Link>
          )}
        </div>
      </Command>
    </CommandDialog>
  );
}
