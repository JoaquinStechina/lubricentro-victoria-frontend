"use client";

import Link from "next/link";
import { ArrowLeftIcon, PackageIcon } from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";
import AutoDescargasView from "@/app/components/autoDescargas/AutoDescargasView";
import { Button } from "@/components/ui/button";

export default function AutoDescargasPage() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-4">
            <Link
              href="/cargas"
              className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowLeftIcon className="size-3.5" />
              Cargas
            </Link>
            <Link href="/stock">
              <Button variant="outline">
                <PackageIcon />
                Stock
              </Button>
            </Link>
            <ThemeToggle />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Auto-descargas por marca
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Marcas de ABC que se descargan solas todos los días y entran al pipeline de carga
            (siempre quedan en revisión, nunca se publican solas).
          </p>
        </header>

        <AutoDescargasView />
      </main>
    </div>
  );
}
