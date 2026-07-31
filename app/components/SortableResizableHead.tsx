"use client";

import { useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Ancho mínimo: menos que esto y el grip + la etiqueta ya ni entran.
const MIN_WIDTH = 56;

type SortableResizableHeadProps = {
  columnKey: string;
  width: number;
  defaultWidth: number;
  onResize: (px: number | null) => void;
  align?: "left" | "right";
  children: ReactNode;
};

// <th> real de una columna de datos en CatalogoView/OfertasView: agrega
// arrastre para reordenar (dnd-kit, mismo mecanismo que ya usa
// ColumnVisibilityMenu para la lista del menú "Columnas", ahora también en
// vivo sobre el propio header) y un handle de resize en el borde derecho.
// El contenido interactivo de la columna (filtro/orden, ver
// ColumnFilterHeader) se recibe como children en vez de manejarse acá, para
// no duplicar esa lógica.
//
// El grip de arrastre es un botón chico aparte (no toda la celda es
// draggable): los headers ya tienen controles interactivos adentro
// (filtro, orden), y arrastrar desde cualquier punto chocaría con esos
// clicks — mismo criterio ya documentado en ColumnVisibilityMenu.tsx.
export default function SortableResizableHead({
  columnKey,
  width,
  defaultWidth,
  onResize,
  align = "left",
  children,
}: SortableResizableHeadProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
  });

  // Ancho "en vivo" mientras se arrastra el handle de resize, sin pisar
  // todavía el valor persistido (onResize) — evita escribir a localStorage
  // en cada pixel de movimiento. table-layout: fixed hace que cambiar el
  // width del <th> redimensione toda la columna (incluidas las celdas del
  // body) sin tocarlas: no hace falta propagar este estado más allá de este
  // componente.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  function handleResizePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = dragWidth ?? width;
    dragStart.current = { x: e.clientX, width: startWidth };

    function onMove(ev: PointerEvent) {
      if (!dragStart.current) return;
      setDragWidth(Math.max(MIN_WIDTH, dragStart.current.width + (ev.clientX - dragStart.current.x)));
    }
    function onUp(ev: PointerEvent) {
      if (dragStart.current) {
        onResize(Math.max(MIN_WIDTH, dragStart.current.width + (ev.clientX - dragStart.current.x)));
      }
      dragStart.current = null;
      setDragWidth(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const finalWidth = dragWidth ?? width;

  return (
    <TableHead
      ref={setNodeRef}
      className={cn(
        "relative",
        align === "right" && "text-right",
        isDragging && "z-10 bg-zinc-100 dark:bg-zinc-800"
      )}
      style={{
        width: finalWidth,
        minWidth: finalWidth,
        maxWidth: finalWidth,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
    >
      {/* El grip siempre queda a la izquierda (punto fijo para agarrar),
          sin importar la alineación del contenido — ColumnFilterHeader ya
          resuelve su propio justify-end interno para columnas a la derecha. */}
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-muted-foreground/40 hover:text-foreground active:cursor-grabbing"
          aria-label={`Mover columna ${columnKey}`}
        >
          <GripVertical className="size-3" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <div
        onPointerDown={handleResizePointerDown}
        onDoubleClick={() => onResize(null)}
        className="absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none hover:bg-primary/40"
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionar columna (doble click para restablecer a ${defaultWidth}px)`}
        title="Arrastrar para cambiar el ancho — doble click para restablecer"
      />
    </TableHead>
  );
}
