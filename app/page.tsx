"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRightIcon, PackageIcon, ReceiptIcon, UploadCloudIcon } from "lucide-react";
import CatalogoView from "@/app/components/CatalogoView";
import OfertasView from "@/app/components/OfertasView";
import ThemeToggle from "@/app/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "catalogo" | "ofertas";

// Identifica cada llegada con `?search=`. La ventana Ctrl + K agrega `?k=`, un
// número nuevo en cada Enter: elegir el mismo código otra vez también cuenta
// como llegada (si no, la URL no cambia y no pasa nada). `k` nunca llega al
// buscador, y un enlace con solo `?search=` sigue andando.
function llegadaConBusqueda(params: URLSearchParams): string | null {
  const search = params.get("search");
  return search ? `${search}|${params.get("k") ?? ""}` : null;
}

// Lee `?search=` (lo usan los enlaces a un código). Va aparte para que el
// Suspense que pide useSearchParams no cubra toda la página.
function CatalogoConBusqueda() {
  const params = useSearchParams();
  const search = params.get("search") ?? undefined;
  // La key remonta la vista en cada llegada (p. ej. Enter en la ventana Ctrl + K estando en el Catálogo).
  return <CatalogoView key={llegadaConBusqueda(params) ?? ""} searchInicial={search} />;
}

// En cada llegada con ?search= (p. ej. Enter en la ventana Ctrl + K) pasa a la pestaña Catálogo.
function CambiarACatalogoConBusqueda({ onBusqueda }: { onBusqueda: () => void }) {
  const llegada = llegadaConBusqueda(useSearchParams());
  useEffect(() => {
    if (llegada) onBusqueda();
  }, [llegada, onBusqueda]);
  return null;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("catalogo");
  const irACatalogo = useCallback(() => setTab("catalogo"), []);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Catálogo centralizado de proveedores
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/cargas">
              <Button variant="outline">
                <UploadCloudIcon />
                Cargar archivo
              </Button>
            </Link>
            <Link href="/equivalencias">
              <Button variant="outline">
                <ArrowLeftRightIcon />
                Equivalencias
              </Button>
            </Link>
            <Link href="/stock">
              <Button variant="outline">
                <PackageIcon />
                Stock
              </Button>
            </Link>
            <Link href="/facturacion">
              <Button variant="outline">
                <ReceiptIcon />
                Facturación
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <Suspense fallback={null}>
          <CambiarACatalogoConBusqueda onBusqueda={irACatalogo} />
        </Suspense>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo">
            {tab === "catalogo" && (
              <Suspense fallback={null}>
                <CatalogoConBusqueda />
              </Suspense>
            )}
          </TabsContent>
          <TabsContent value="ofertas">
            {tab === "ofertas" && <OfertasView />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
