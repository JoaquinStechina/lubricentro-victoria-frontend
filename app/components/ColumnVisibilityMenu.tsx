"use client";

import { useState } from "react";
import { Columns3, GripVertical, RotateCcw } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ColumnOption = { key: string; label: string };

type ColumnVisibilityMenuProps = {
  columns: ColumnOption[];
  order: string[];
  hidden: Set<string>;
  onReorder: (order: string[]) => void;
  onToggle: (key: string) => void;
  onReset: () => void;
};

// Reordenar acá (panel aislado) en vez de arrastrando el <th> en vivo: los
// headers de la tabla ya tienen controles interactivos adentro (filtro,
// orden), y hacerlos arrastrables chocaría con esos clicks.
export default function ColumnVisibilityMenu({
  columns,
  order,
  hidden,
  onReorder,
  onToggle,
  onReset,
}: ColumnVisibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const orderedColumns = order
    .map((key) => byKey.get(key))
    .filter((c): c is ColumnOption => c !== undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(order, oldIndex, newIndex));
  }

  const cantidadOcultas = hidden.size;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="relative" />}>
        <Columns3 className="size-3.5" />
        Columnas
        {cantidadOcultas > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {cantidadOcultas}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="mb-1.5 px-1 text-xs text-muted-foreground">Mostrar y ordenar columnas</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              {orderedColumns.map((col) => (
                <SortableColumnRow
                  key={col.key}
                  id={col.key}
                  label={col.label}
                  checked={!hidden.has(col.key)}
                  onToggle={() => onToggle(col.key)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <button
          type="button"
          onClick={onReset}
          className="mt-1.5 flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          Restablecer
        </button>
      </PopoverContent>
    </Popover>
  );
}

function SortableColumnRow({
  id,
  label,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2 rounded px-1 py-1 text-sm", isDragging && "z-10 bg-muted")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
        aria-label={`Reordenar ${label.toLowerCase()}`}
      >
        <GripVertical className="size-3.5" />
      </button>
      <label className="flex flex-1 cursor-pointer items-center gap-2">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Mostrar ${label.toLowerCase()}`}
        />
        <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
      </label>
    </li>
  );
}
