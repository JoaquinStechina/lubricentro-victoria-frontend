"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// widths: overrides por columna (px) sobre el ancho por defecto que define
// cada vista (CatalogoView/OfertasView) — acá solo se persiste la
// excepción, el default en sí no lo conoce este hook.
type Prefs = { order: string[]; hidden: string[]; widths: Record<string, number> };

const EMPTY_HIDDEN: string[] = [];
const EMPTY_WIDTHS: Record<string, number> = {};

// Cache en memoria por storageKey: getSnapshot debe devolver la misma
// referencia si nada cambió (contrato de useSyncExternalStore), así que el
// valor se lee de localStorage una sola vez y después solo se actualiza acá.
const cache = new Map<string, Prefs>();
const listeners = new Map<string, Set<() => void>>();
// getServerSnapshot debe devolver la misma referencia en cada llamada (mismo
// contrato que getSnapshot) — si no, React tira "should be cached" y re-
// renderiza en loop.
const serverSnapshotCache = new Map<string, Prefs>();

function getServerSnapshot(storageKey: string, defaultOrder: string[]): Prefs {
  let snapshot = serverSnapshotCache.get(storageKey);
  if (!snapshot) {
    snapshot = { order: defaultOrder, hidden: EMPTY_HIDDEN, widths: EMPTY_WIDTHS };
    serverSnapshotCache.set(storageKey, snapshot);
  }
  return snapshot;
}

function readFromStorage(storageKey: string, defaultOrder: string[]): Prefs {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { order: defaultOrder, hidden: EMPTY_HIDDEN, widths: EMPTY_WIDTHS };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const savedOrder = Array.isArray(parsed.order) ? parsed.order.filter((k) => defaultOrder.includes(k)) : [];
    // Columnas nuevas (agregadas después de que el usuario guardó sus
    // preferencias) se agregan al final en vez de quedar escondidas.
    const faltantes = defaultOrder.filter((k) => !savedOrder.includes(k));
    const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter((k) => defaultOrder.includes(k)) : [];
    const widths =
      parsed.widths && typeof parsed.widths === "object" && !Array.isArray(parsed.widths)
        ? Object.fromEntries(
            Object.entries(parsed.widths).filter(
              ([k, v]) => defaultOrder.includes(k) && typeof v === "number" && Number.isFinite(v)
            )
          )
        : EMPTY_WIDTHS;
    return { order: [...savedOrder, ...faltantes], hidden, widths };
  } catch {
    return { order: defaultOrder, hidden: EMPTY_HIDDEN, widths: EMPTY_WIDTHS };
  }
}

function getSnapshot(storageKey: string, defaultOrder: string[]): Prefs {
  let cached = cache.get(storageKey);
  if (!cached) {
    cached = readFromStorage(storageKey, defaultOrder);
    cache.set(storageKey, cached);
  }
  return cached;
}

function setPrefs(storageKey: string, next: Prefs) {
  cache.set(storageKey, next);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // localStorage puede fallar (modo privado, cuota) — la preferencia
    // simplemente no persiste, no es un error que deba interrumpir nada.
  }
  listeners.get(storageKey)?.forEach((l) => l());
}

function subscribe(storageKey: string, listener: () => void) {
  let set = listeners.get(storageKey);
  if (!set) {
    set = new Set();
    listeners.set(storageKey, set);
  }
  set.add(listener);
  return () => set!.delete(listener);
}

// Preferencia de vista (qué columnas se ven y en qué orden), no un dato de
// negocio: se guarda por browser en localStorage, no en el backend.
// useSyncExternalStore en vez de useEffect+setState: el valor real puede
// diferir entre el render de servidor (sin localStorage) y el de cliente —
// esta es la forma que React da para resolver eso sin el doble render de un
// efecto (getServerSnapshot cubre el primer paint, se corrige solo después).
export function useColumnPrefs(storageKey: string, defaultOrder: string[]) {
  const prefs = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(storageKey, listener), [storageKey]),
    useCallback(() => getSnapshot(storageKey, defaultOrder), [storageKey, defaultOrder]),
    useCallback(() => getServerSnapshot(storageKey, defaultOrder), [storageKey, defaultOrder])
  );

  const setOrder = useCallback(
    (nextOrder: string[]) => {
      setPrefs(storageKey, { ...getSnapshot(storageKey, defaultOrder), order: nextOrder });
    },
    [storageKey, defaultOrder]
  );

  const toggleColumn = useCallback(
    (key: string) => {
      const current = getSnapshot(storageKey, defaultOrder);
      const nextHidden = current.hidden.includes(key)
        ? current.hidden.filter((k) => k !== key)
        : [...current.hidden, key];
      setPrefs(storageKey, { ...current, hidden: nextHidden });
    },
    [storageKey, defaultOrder]
  );

  // px === null borra el override (vuelve al default que maneja la vista) —
  // lo usa el doble click en el handle de resize para "restablecer" una
  // columna sin tener que resetear el resto de las preferencias.
  const setWidth = useCallback(
    (key: string, px: number | null) => {
      const current = getSnapshot(storageKey, defaultOrder);
      const nextWidths = { ...current.widths };
      if (px === null) delete nextWidths[key];
      else nextWidths[key] = px;
      setPrefs(storageKey, { ...current, widths: nextWidths });
    },
    [storageKey, defaultOrder]
  );

  const reset = useCallback(() => {
    cache.delete(storageKey);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ver comentario en setPrefs().
    }
    setPrefs(storageKey, { order: defaultOrder, hidden: EMPTY_HIDDEN, widths: EMPTY_WIDTHS });
  }, [storageKey, defaultOrder]);

  return {
    order: prefs.order,
    hidden: useMemo(() => new Set(prefs.hidden), [prefs.hidden]),
    widths: prefs.widths,
    setOrder,
    toggleColumn,
    setWidth,
    reset,
  };
}
