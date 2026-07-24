// Tipo del dominio de auto-descarga por marca. Copia deliberada de
// backend/prisma/schema.prisma (AutoDescargaMarca) — no hay paquete
// compartido entre los dos repos, mismo criterio que app/lib/cargas.ts.
import type { Proveedor } from "@/app/lib/cargas";

export type AutoDescargaMarca = {
  id: number;
  proveedorId: number;
  proveedor: Proveedor;
  marca: string;
  activo: boolean;
  porcentajeGanancia: number | null;
  ultimoHashArchivo: string | null;
  ultimaCorridaEn: string | null;
  ultimoResultado: string | null;
  ultimaCargaId: number | null;
  createdAt: string;
};
