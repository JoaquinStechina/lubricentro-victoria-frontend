"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatearMoneda } from "@/app/lib/facturacion";
import type { ResultadoEquivalencia } from "@/app/lib/equivalencias";
import { cn } from "@/lib/utils";

// Contenido de una fila de equivalencia. Lo usan la lista del Catálogo (dentro de un <li>)
// y la ventana Ctrl + K (dentro de un CommandItem).
export function FilaEquivalencia({
  r,
  onElegir,
  onDescartar,
  compacta = false,
}: {
  r: ResultadoEquivalencia;
  onElegir?: (codigo: string) => void;
  onDescartar?: (r: ResultadoEquivalencia) => void;
  compacta?: boolean;
}) {
  const producto = r.productos[0];
  const sinProductos = r.productos.length === 0;
  return (
    <div
      className={cn("min-w-0 flex-1", sinProductos && "text-muted-foreground")}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          disabled={!onElegir}
          onClick={() => onElegir?.(r.codigo)}
          className={cn(
            "font-medium",
            onElegir && "hover:underline",
            !sinProductos && "text-foreground",
          )}
        >
          {r.marca ? `${r.marca} ` : ""}
          {r.codigo}
        </button>
        {r.via && (
          <Badge variant="outline">
            vía {r.via.marca ? `${r.via.marca} ` : ""}
            {r.via.codigo}
          </Badge>
        )}
        {r.confianza === "media" && <Badge variant="secondary">posible</Badge>}
        {producto && (
          <span className="text-sm">
            {producto.descripcion ?? "Sin descripción"} · {producto.proveedor}
            {producto.precioSugerido !== null &&
              ` · ${formatearMoneda(producto.precioSugerido)}`}
          </span>
        )}
        {(r.stock !== null || !sinProductos) &&
          (r.stock !== null && r.stock > 0 ? (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              stock {r.stock}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">sin stock</span>
          ))}
        {onDescartar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              onDescartar(r);
            }}
          >
            Descartar
          </Button>
        )}
      </div>
      {!compacta && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Por qué: {r.fuente}
          {r.textoOrigen ? ` · ${r.textoOrigen}` : ""}
        </p>
      )}
    </div>
  );
}

// Lista de equivalencias compartida por el Catálogo y el buscador del mostrador.
export default function ListaEquivalencias({
  q,
  resultado,
  onElegir,
  onDescartar,
  compacta = false,
}: {
  q: string;
  resultado: ResultadoEquivalencia[];
  onElegir?: (codigo: string) => void;
  onDescartar?: (r: ResultadoEquivalencia) => void;
  compacta?: boolean;
}) {
  if (resultado.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">
          EQUIVALENCIAS DE {q}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <ul className="divide-y">
        {resultado.map((r) => (
          <li
            key={`${r.marcaNorm}|${r.codigoNorm}`}
            className={compacta ? "py-1.5" : "py-2.5"}
          >
            <FilaEquivalencia
              r={r}
              onElegir={onElegir}
              onDescartar={onDescartar}
              compacta={compacta}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
