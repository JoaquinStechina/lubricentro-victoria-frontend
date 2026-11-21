"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PackageIcon, ReceiptIcon, UploadCloudIcon } from "lucide-react";
import CatalogoView from "@/app/components/CatalogoView";
import OfertasView from "@/app/components/OfertasView";
import ThemeToggle from "@/app/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "catalogo" | "ofertas";

// Lee `?search=` (lo usan los enlaces a un código). Va aparte para que el
// Suspense que pide useSearchParams no cubra toda la página.
function CatalogoConBusqueda() {
  const search = useSearchParams().get("search") ?? undefined;
  // La key remonta la vista cuando cambia ?search= (p. ej. Enter en la ventana Ctrl + K estando en el Catálogo).
  return <CatalogoView key={search ?? ""} searchInicial={search} />;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("catalogo");

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
