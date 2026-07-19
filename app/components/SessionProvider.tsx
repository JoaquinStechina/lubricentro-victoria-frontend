"use client";

import { createContext, useContext } from "react";
import type { Session } from "@/app/lib/session";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

// `proxy.ts` garantiza que toda página (salvo /login) se renderiza con
// sesión válida, así que los componentes protegidos pueden asumir non-null
// acá adentro; solo queda null momentáneamente en /login.
export function useSession(): Session | null {
  return useContext(SessionContext);
}
