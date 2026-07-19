"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOutIcon, UsersIcon } from "lucide-react";
import { useSession } from "@/app/components/SessionProvider";
import { API_URL } from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ROL_LABELS: Record<string, string> = {
  SYSADMIN: "Sysadmin",
  ADMINISTRADOR: "Administrador",
  EMPLEADO: "Empleado",
};

export default function UserMenu() {
  const session = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!session) return null;

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      {session.rol === "SYSADMIN" && (
        <Link href="/usuarios">
          <Button variant="ghost" size="sm">
            <UsersIcon />
            Usuarios
          </Button>
        </Link>
      )}
      <div className="hidden flex-col items-end leading-tight sm:flex">
        <span className="text-sm font-medium text-black dark:text-zinc-50">{session.nombre}</span>
        <Badge variant="outline" className="text-[10px]">
          {ROL_LABELS[session.rol] ?? session.rol}
        </Badge>
      </div>
      <Button variant="outline" size="sm" onClick={handleLogout} disabled={loading}>
        <LogOutIcon />
        Salir
      </Button>
    </div>
  );
}
