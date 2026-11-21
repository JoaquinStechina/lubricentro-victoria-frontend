"use client";

import { useEffect, useState } from "react";
import ListaEquivalencias from "@/app/components/equivalencias/ListaEquivalencias";
import { buscarEquivalencias, esCodigoBuscable, type RespuestaBusqueda } from "@/app/lib/equivalencias";

// Sección «EQUIVALENCIAS DE <q>» bajo la tabla del Catálogo. Hace su propio
// pedido, con debounce, y descarta las respuestas viejas. Si q no parece un
// código no consulta ni renderiza nada.
export default function SeccionEquivalencias({
  q,
  onElegir,
}: {
  q: string;
  onElegir?: (codigo: string) => void;
}) {
  const consulta = q.trim();
  const buscable = esCodigoBuscable(consulta);
  // La respuesta lleva la q que la originó: si q cambia, la anterior no se muestra.
  const [respuesta, setRespuesta] = useState<RespuestaBusqueda | null>(null);

  useEffect(() => {
    if (!buscable) return;
    const controller = new AbortController();
    const id = setTimeout(() => {
      buscarEquivalencias(consulta, controller.signal)
        .then((r) => setRespuesta({ ...r, q: consulta }))
        .catch(() => {
          if (!controller.signal.aborted) setRespuesta(null);
        });
    }, 300);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [consulta, buscable]);

  if (!buscable || !respuesta || respuesta.q !== consulta) return null;

  return (
    <section className="mt-4">
      {respuesta.productosBuscados.length === 0 && (
        <p className="text-sm text-muted-foreground">Ningún producto del catálogo tiene el código {consulta}</p>
      )}
      <ListaEquivalencias q={consulta} resultado={respuesta.equivalencias} onElegir={onElegir} />
    </section>
  );
}
