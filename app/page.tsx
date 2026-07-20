"use client";

import Link from "next/link";
import { useState } from "react";
import { UploadCloudIcon } from "lucide-react";
import CatalogoView from "@/app/components/CatalogoView";
import OfertasView from "@/app/components/OfertasView";
import UserMenu from "@/app/components/UserMenu";
import { useSession } from "@/app/components/SessionProvider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "catalogo" | "ofertas";

export default function Home() {
  const [tab, setTab] = useState<Tab>("catalogo");
  const session = useSession();
  const puedeCargarDatos = session?.rol === "ADMINISTRADOR" || session?.rol === "SYSADMIN";

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Catálogo centralizado de proveedores
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Prototipo de visualización sobre las listas de precios y ofertas
              ya parseadas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {puedeCargarDatos && (
              <Link href="/cargas">
                <Button variant="outline">
                  <UploadCloudIcon />
                  Cargar archivo
                </Button>
              </Link>
            )}
            <UserMenu />
          </div>
        </header>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo">
            {tab === "catalogo" && <CatalogoView />}
          </TabsContent>
          <TabsContent value="ofertas">
            {tab === "ofertas" && <OfertasView />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
