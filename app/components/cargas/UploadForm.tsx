"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, UploadCloudIcon } from "lucide-react";
import { API_URL, apiFetch } from "@/app/lib/api";
import {
  ACCEPTED_EXTENSIONS,
  TIPO_DATOS_LABELS,
  type Carga,
  type Proveedor,
  type TipoDatos,
} from "@/app/lib/cargas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

type UploadFormProps = {
  onUploaded: (carga: Carga) => void;
};

export default function UploadForm({ onUploaded }: UploadFormProps) {
  const [tipoDatos, setTipoDatos] = useState<TipoDatos>("catalogo");
  const [sinFechaLimite, setSinFechaLimite] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [proveedorOpen, setProveedorOpen] = useState(false);
  const [proveedorQuery, setProveedorQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    apiFetch<Proveedor[]>("/api/proveedores")
      .then((data) => {
        if (active) setProveedores(data);
      })
      .catch(() => {
        // Sin lista de proveedores no se rompe el formulario: el campo
        // sigue aceptando texto libre.
      });
    return () => {
      active = false;
    };
  }, []);

  const proveedoresFiltrados = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(proveedorQuery.trim().toLowerCase())
  );
  const coincideExacto = proveedores.some(
    (p) => p.nombre.toLowerCase() === proveedorQuery.trim().toLowerCase()
  );

  function handleFileChange(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Tipo de archivo no soportado: ${ext}. Aceptados: ${ACCEPTED_EXTENSIONS.join(", ")}`);
      return;
    }
    setError(null);
    setFile(f);
  }

  async function handleSubmit() {
    if (!file) {
      setError("Elegí un archivo para subir.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipoDatos", tipoDatos);
      if (tipoDatos === "oferta") formData.append("sinFechaLimite", String(sinFechaLimite));
      if (proveedorNombre.trim()) formData.append("proveedor", proveedorNombre.trim());

      const res = await fetch(`${API_URL}/api/uploads`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Error ${res.status} subiendo el archivo.`);
      }
      const carga: Carga = await res.json();
      onUploaded(carga);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mb-6 flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Tipo de archivo</span>
        <div className="inline-flex w-fit rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800">
          {(Object.keys(TIPO_DATOS_LABELS) as TipoDatos[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setTipoDatos(opcion)}
              className={cn(
                "rounded px-3 py-1 text-sm transition-colors",
                tipoDatos === opcion
                  ? "bg-primary text-primary-foreground"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              )}
            >
              {TIPO_DATOS_LABELS[opcion]}
            </button>
          ))}
        </div>
      </div>

      {tipoDatos === "oferta" && (
        <label
          htmlFor="sin-fecha-limite"
          className="flex w-fit cursor-pointer items-center gap-2 text-sm"
        >
          <Switch
            id="sin-fecha-limite"
            checked={sinFechaLimite}
            onCheckedChange={setSinFechaLimite}
          />
          <span className="text-zinc-700 dark:text-zinc-300">Hasta agotar stock</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-500">
            (sin fecha de vencimiento — no le pedimos a la IA que busque una)
          </span>
        </label>
      )}

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Proveedor</span>
        <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="w-64 justify-between font-normal"
              />
            }
          >
            <span className={proveedorNombre ? "" : "text-muted-foreground"}>
              {proveedorNombre || "Elegir o escribir proveedor…"}
            </span>
            <ChevronsUpDownIcon className="size-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Buscar proveedor…"
                value={proveedorQuery}
                onValueChange={setProveedorQuery}
              />
              <CommandList>
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandGroup>
                  {proveedoresFiltrados.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.nombre}
                      onSelect={() => {
                        setProveedorNombre(p.nombre);
                        setProveedorQuery("");
                        setProveedorOpen(false);
                      }}
                    >
                      <CheckIcon
                        className={cn(
                          "size-3.5",
                          proveedorNombre === p.nombre ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {p.nombre}
                    </CommandItem>
                  ))}
                  {proveedorQuery.trim() && !coincideExacto && (
                    <CommandItem
                      value={`crear-${proveedorQuery}`}
                      onSelect={() => {
                        setProveedorNombre(proveedorQuery.trim());
                        setProveedorQuery("");
                        setProveedorOpen(false);
                      }}
                    >
                      <PlusIcon className="size-3.5" />
                      Crear “{proveedorQuery.trim()}”
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Opcional, pero recomendado: sin proveedor no se puede resolver el mapeo de columnas.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFileChange(e.dataTransfer.files[0] ?? null);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        )}
      >
        <UploadCloudIcon className="size-6 text-zinc-400" />
        {file ? (
          <p className="text-sm text-zinc-900 dark:text-zinc-100">{file.name}</p>
        ) : (
          <>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Arrastrá un archivo acá, o hacé clic para elegirlo
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              {ACCEPTED_EXTENSIONS.join(", ")} — hasta 50MB
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!file || uploading}>
          {uploading ? "Subiendo…" : "Subir archivo"}
        </Button>
      </div>
    </section>
  );
}
