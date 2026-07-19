"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import UserMenu from "@/app/components/UserMenu";
import UsuariosView from "@/app/components/usuarios/UsuariosView";

export default function UsuariosPage() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 w-full flex-col px-6 py-10 sm:px-10">
        <header className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ArrowLeftIcon className="size-3.5" />
              Catálogo
            </Link>
            <UserMenu />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Usuarios
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Crear y administrar cuentas de administrador y empleado.
          </p>
        </header>

        <UsuariosView />
      </main>
    </div>
  );
}
