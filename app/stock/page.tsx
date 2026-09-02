"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";
import StockView from "@/app/components/stock/StockView";
import MovimientosView from "@/app/components/stock/MovimientosView";
import ReposicionView from "@/app/components/stock/ReposicionView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "articulos" | "movimientos" | "reposicion";

export default function StockPage() {
  const [tab, setTab] = useState<Tab>("articulos");

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-foreground dark:text-zinc-400"
            >
              <ArrowLeftIcon className="size-3.5" />
              Catálogo
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Stock
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Inventario propio del lubricentro: qué hay en el local, cómo se movió y qué falta
              reponer.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="articulos">Artículos</TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
            <TabsTrigger value="reposicion">Reposición</TabsTrigger>
          </TabsList>

          {/* Cada vista se monta solo cuando su pestaña está activa: así no se
              disparan tres fetchs al entrar, y volver a una pestaña trae datos
              frescos (igual que Catálogo/Ofertas en la home). */}
          <TabsContent value="articulos">{tab === "articulos" && <StockView />}</TabsContent>
          <TabsContent value="movimientos">{tab === "movimientos" && <MovimientosView />}</TabsContent>
          <TabsContent value="reposicion">{tab === "reposicion" && <ReposicionView />}</TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
