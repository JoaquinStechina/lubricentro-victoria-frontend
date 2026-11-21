"use client";

import { useEffect, useState } from "react";
import ListaEquivalencias from "@/app/components/equivalencias/ListaEquivalencias";
import { buscarEquivalencias, esCodigoBuscable, type RespuestaBusqueda } from "@/app/lib/equivalencias";

// Sección «EQUIVALENCIAS DE <q>» bajo la tabla del Catálogo. Hace su propio
// pedido, con debounce, y descarta las respuestas viejas. Si q no parece un
// código no consulta ni renderiza nada.
//
// «Ningún producto del catálogo tiene el código …» sale solo con la tabla
// vacía: un texto con dígitos como «10w40» parece un código pero llena la
// tabla de aceites, y ahí la frase la contradiría.
export default function SeccionEquivalencias({
  q,
  tablaVacia,
  onElegir,
}: {
  q: string;
  tablaVacia: boolean;
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
  const sinProducto = tablaVacia && respuesta.productosBuscados.length === 0;
  if (!sinProducto && respuesta.equivalencias.length === 0) return null;

  return (
    <section className="mt-4">
      {sinProducto && (
        <p className="text-sm text-muted-foreground">Ningún producto del catálogo tiene el código {consulta}</p>
      )}
      <ListaEquivalencias q={consulta} resultado={respuesta.equivalencias} onElegir={onElegir} />
    </section>
  );
}
