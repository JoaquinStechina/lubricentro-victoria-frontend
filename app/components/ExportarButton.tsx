"use client";

import { useState } from "react";
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { apiDownload } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ExportarButtonProps = {
  // Ruta del endpoint de export (ej. "/api/productos/export").
  exportPath: string;
  // Los mismos filtros/orden que está usando la tabla, SIN page/pageSize —
  // el export siempre baja el resultado filtrado completo.
  getParams: () => URLSearchParams;
  // Base del nombre de archivo descargado ("catalogo" | "ofertas").
  nombreArchivo: string;
};

// Botón "Exportar" con menú de formato (Popover con dos botones — el
// proyecto no tiene componente dropdown-menu y para dos opciones alcanza).
export default function ExportarButton({
  exportPath,
  getParams,
  nombreArchivo,
}: ExportarButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar(formato: "csv" | "xlsx") {
    setExporting(true);
    setError(null);
    try {
      const params = getParams();
      params.set("formato", formato);
      const fecha = new Intl.DateTimeFormat("en-CA").format(new Date());
      await apiDownload(
        `${exportPath}?${params.toString()}`,
        `${nombreArchivo}-${fecha}.${formato}`
      );
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>
        <DownloadIcon />
        Exportar
      </PopoverTrigger>
      <PopoverContent className="flex w-44 flex-col gap-1 p-1" align="end">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          disabled={exporting}
          onClick={() => descargar("xlsx")}
        >
          <FileSpreadsheetIcon />
          Excel (.xlsx)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          disabled={exporting}
          onClick={() => descargar("csv")}
        >
          <FileTextIcon />
          CSV (.csv)
        </Button>
        {exporting && (
          <p className="px-2 pb-1 text-xs text-muted-foreground">Generando archivo…</p>
        )}
        {error && <p className="px-2 pb-1 text-xs text-destructive">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
