"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ENLACES = [
  { href: "/facturacion", label: "Comprobantes" },
  { href: "/ventas", label: "Ventas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/facturacion/config", label: "Datos fiscales" },
];

// "Comprobantes" vive en /facturacion y sus hijas (/facturacion/123), pero
// /facturacion/config es otra sección: sin esta excepción quedarían los dos
// enlaces resaltados a la vez.
function estaActivo(href: string, pathname: string): boolean {
  if (href === "/facturacion") {
    return pathname === href || (pathname.startsWith(`${href}/`) && !pathname.startsWith("/facturacion/config"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function FacturacionNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Facturación" className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
      {ENLACES.map(({ href, label }) => {
        const activo = estaActivo(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              activo
                ? "border-black text-black dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
