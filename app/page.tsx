"use client";

import { useState } from "react";
import CatalogoView from "@/app/components/CatalogoView";
import OfertasView from "@/app/components/OfertasView";

type Tab = "catalogo" | "ofertas";

export default function Home() {
  const [tab, setTab] = useState<Tab>("catalogo");

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Catálogo centralizado de proveedores
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Prototipo de visualización sobre las listas de precios y ofertas
            ya parseadas.
          </p>
        </header>

        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setTab("catalogo")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "catalogo"
                ? "border-b-2 border-black text-black dark:border-zinc-50 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Catálogo ({(31586).toLocaleString("es-AR")})
          </button>
          <button
            onClick={() => setTab("ofertas")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "ofertas"
                ? "border-b-2 border-black text-black dark:border-zinc-50 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Ofertas ({(1018).toLocaleString("es-AR")})
          </button>
        </div>

        {tab === "catalogo" ? <CatalogoView /> : <OfertasView />}
      </main>
    </div>
  );
}
