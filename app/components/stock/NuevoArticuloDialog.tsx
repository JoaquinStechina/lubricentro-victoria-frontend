"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PlusIcon } from "lucide-react";
import { apiFetch, apiJsonInit } from "@/app/lib/api";
import type { Producto } from "@/app/lib/productos";
import type { ArticuloStock } from "@/app/lib/stock";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FormValues = {
  marca: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  ubicacion: string;
  minimo: string;
  cantidadInicial: string;
};

function emptyForm(): FormValues {
  return {
    marca: "",
    codigo: "",
    descripcion: "",
    categoria: "",
    ubicacion: "",
    minimo: "",
    cantidadInicial: "",
  };
}

// Alta de un artículo de stock (inventario propio, ver app/lib/stock.ts).
// El modo "Desde catálogo" no reemplaza el formulario: solo precompleta
// marca/código/descripción a partir de un Producto ya cargado (GET
// /api/productos?search=), y el usuario sigue pudiendo corregir cualquier
// campo antes de guardar. Ambos modos terminan en el mismo POST /api/stock.
export default function NuevoArticuloDialog({ onCreado }: { onCreado: () => void }) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<"manual" | "catalogo">("manual");
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [buscadorOpen, setBuscadorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscando, setBuscando] = useState(false);

  const trimmedQuery = query.trim();

  // Búsqueda contra el catálogo con debounce de 300ms, mismo criterio que
  // useTablaRecurso.ts. El flag `active` evita que una respuesta vieja
  // (request lento) pise el resultado de una búsqueda más nueva. Los
  // setState quedan todos dentro del callback del timeout/promesa (nunca
  // sincrónicos en el cuerpo del efecto): con la query vacía no hace falta
  // limpiar nada acá, `resultadosMostrados`/`mostrandoCarga` abajo ya
  // derivan la lista vacía sin tocar estado.
  useEffect(() => {
    if (!trimmedQuery) return;
    let active = true;
    const id = setTimeout(() => {
      if (!active) return;
      setBuscando(true);
      const params = new URLSearchParams({ search: trimmedQuery, pageSize: "20" });
      apiFetch<{ items: Producto[] }>(`/api/productos?${params.toString()}`)
        .then((res) => {
          if (active) setResultados(res.items);
        })
        .catch(() => {
          if (active) setResultados([]);
        })
        .finally(() => {
          if (active) setBuscando(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [trimmedQuery]);

  const resultadosMostrados = trimmedQuery ? resultados : [];
  const mostrandoCarga = Boolean(trimmedQuery) && buscando;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setModo("manual");
      setValues(emptyForm());
      setError(null);
      setQuery("");
      setResultados([]);
      setBuscadorOpen(false);
    }
  }

  function setField(campo: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [campo]: value }));
  }

  function handleElegirProducto(producto: Producto) {
    setValues((prev) => ({
      ...prev,
      marca: producto.marca ?? "",
      codigo: producto.skuProveedor ?? producto.skuInterno ?? "",
      descripcion: producto.descripcion ?? "",
    }));
    setBuscadorOpen(false);
    setQuery("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.marca.trim() || !values.codigo.trim() || !values.descripcion.trim()) {
      setError("Marca, código y descripción son obligatorios.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiFetch<ArticuloStock>(
        "/api/stock",
        apiJsonInit({
          marca: values.marca.trim(),
          codigo: values.codigo.trim(),
          descripcion: values.descripcion.trim(),
          categoria: values.categoria.trim() || null,
          ubicacion: values.ubicacion.trim() || null,
          minimo: values.minimo === "" ? null : Number(values.minimo),
          cantidadInicial: values.cantidadInicial === "" ? 0 : Number(values.cantidadInicial),
        })
      );
      onCreado();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el artículo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Nuevo artículo
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nuevo artículo</DialogTitle>
            <DialogDescription>Alta manual o a partir de un producto del catálogo.</DialogDescription>
          </DialogHeader>

          <Tabs value={modo} onValueChange={(value) => setModo(value as "manual" | "catalogo")}>
            <TabsList className="w-full">
              <TabsTrigger value="manual" className="flex-1">
                Manual
              </TabsTrigger>
              <TabsTrigger value="catalogo" className="flex-1">
                Desde catálogo
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="pt-3">
              <p className="text-xs text-muted-foreground">Completá los datos del artículo a mano.</p>
            </TabsContent>
            <TabsContent value="catalogo" className="pt-3">
              <div className="flex flex-col gap-1.5">
                <Label>Buscar en catálogo</Label>
                <Popover open={buscadorOpen} onOpenChange={setBuscadorOpen}>
                  <PopoverTrigger
                    render={<Button type="button" variant="outline" className="w-full justify-start font-normal" />}
                  >
                    Buscar por marca, código o descripción…
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Buscar producto…" value={query} onValueChange={setQuery} />
                      <CommandList>
                        {mostrandoCarga && (
                          <div className="py-6 text-center text-sm text-muted-foreground">Buscando…</div>
                        )}
                        {!mostrandoCarga && (
                          <CommandEmpty>
                            {trimmedQuery ? "Sin resultados." : "Escribí para buscar un producto…"}
                          </CommandEmpty>
                        )}
                        <CommandGroup>
                          {resultadosMostrados.map((producto) => (
                            <CommandItem
                              key={producto.id}
                              value={String(producto.id)}
                              onSelect={() => handleElegirProducto(producto)}
                            >
                              {producto.marca ?? "—"} — {producto.skuProveedor ?? producto.skuInterno ?? "—"} —{" "}
                              {producto.descripcion ?? "—"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Elegí un producto para completar marca, código y descripción. Podés corregir cualquier campo antes
                  de guardar.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-articulo-marca">Marca</Label>
              <Input
                id="nuevo-articulo-marca"
                required
                value={values.marca}
                onChange={(e) => setField("marca", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-articulo-codigo">Código</Label>
              <Input
                id="nuevo-articulo-codigo"
                required
                value={values.codigo}
                onChange={(e) => setField("codigo", e.target.value)}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="nuevo-articulo-descripcion">Descripción</Label>
              <Input
                id="nuevo-articulo-descripcion"
                required
                value={values.descripcion}
                onChange={(e) => setField("descripcion", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-articulo-categoria">Categoría</Label>
              <Input
                id="nuevo-articulo-categoria"
                value={values.categoria}
                onChange={(e) => setField("categoria", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-articulo-ubicacion">Ubicación</Label>
              <Input
                id="nuevo-articulo-ubicacion"
                value={values.ubicacion}
                onChange={(e) => setField("ubicacion", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-articulo-minimo">Mínimo</Label>
              <Input
                id="nuevo-articulo-minimo"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={values.minimo}
                onChange={(e) => setField("minimo", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nuevo-articulo-cantidad-inicial">Cantidad inicial</Label>
              <Input
                id="nuevo-articulo-cantidad-inicial"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={values.cantidadInicial}
                onChange={(e) => setField("cantidadInicial", e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear artículo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
