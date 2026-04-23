'use client';

import { useEffect, useState, useSyncExternalStore } from "react";

export const DEMO_SESSION_KEY = "tokoku_demo_session";
export const DEMO_META_KEY = "tokoku_demo_meta";

export interface DemoMeta {
  sessionKey: string;
  storeId: string;
  userId: string;
  expiresAt: string;
  remainingMs?: number;
  remainingMinutes?: number;
}

export function getDemoDurationMs(): number {
  const hours = parseFloat(process.env.NEXT_PUBLIC_DEMO_DURATION_HOURS ?? "1");
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 1;
  return safeHours * 60 * 60 * 1000;
}

function hasStorage() {
  return typeof window !== "undefined";
}

function emitDemoMetaChange() {
  if (!hasStorage()) return;
  window.dispatchEvent(new Event("demo-meta-change"));
}

function subscribeDemoMeta(onStoreChange: () => void) {
  if (!hasStorage()) {
    return () => undefined;
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("demo-meta-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("demo-meta-change", onStoreChange);
  };
}

// Cache untuk menghindari infinite loop pada useSyncExternalStore.
// readDemoMeta harus return referensi yang sama selama data tidak berubah.
let _cachedRaw: string | null = undefined!;
let _cachedMeta: DemoMeta | null = null;

export function readDemoMeta(): DemoMeta | null {
  if (!hasStorage()) return null;

  const raw = window.localStorage.getItem(DEMO_META_KEY);

  // Hanya parse ulang kalau isi localStorage benar-benar berubah
  if (raw === _cachedRaw) return _cachedMeta;

  _cachedRaw = raw;

  if (!raw) {
    _cachedMeta = null;
    return null;
  }

  try {
    _cachedMeta = JSON.parse(raw) as DemoMeta;
  } catch {
    window.localStorage.removeItem(DEMO_META_KEY);
    _cachedMeta = null;
  }

  return _cachedMeta;
}

export function persistDemoMeta(meta: DemoMeta) {
  if (!hasStorage()) return;
  window.localStorage.setItem(DEMO_SESSION_KEY, meta.sessionKey);
  window.localStorage.setItem(DEMO_META_KEY, JSON.stringify(meta));
  _cachedRaw = undefined!; // Invalidate cache agar readDemoMeta parse ulang
  emitDemoMetaChange();
}

export function clearDemoMeta() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(DEMO_SESSION_KEY);
  window.localStorage.removeItem(DEMO_META_KEY);
  _cachedRaw = undefined!; // Invalidate cache agar readDemoMeta parse ulang
  emitDemoMetaChange();
}

type DemoApiResponse = DemoMeta & {
  active: boolean;
};

async function createDemoSession(): Promise<DemoMeta | null> {
  const res = await fetch("/api/demo/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionKey: null }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as DemoApiResponse;
  if (!data.sessionKey || !data.storeId || !data.userId) return null;

  const meta: DemoMeta = {
    sessionKey: data.sessionKey,
    storeId: data.storeId,
    userId: data.userId,
    expiresAt: data.expiresAt,
    remainingMs: data.remainingMs,
    remainingMinutes: data.remainingMinutes,
  };

  persistDemoMeta(meta);
  return meta;
}

export async function ensureDemoSession(existingSessionKey?: string | null): Promise<DemoMeta | null> {
  const sessionKey = existingSessionKey ?? readDemoMeta()?.sessionKey ?? null;

  if (sessionKey) {
    const res = await fetch(`/api/demo/reset?sessionKey=${encodeURIComponent(sessionKey)}`);
    if (res.ok) {
      const data = (await res.json()) as DemoApiResponse;

      if (data.active && data.storeId && data.userId) {
        const meta: DemoMeta = {
          sessionKey: data.sessionKey,
          storeId: data.storeId,
          userId: data.userId,
          expiresAt: data.expiresAt,
          remainingMs: data.remainingMs,
          remainingMinutes: data.remainingMinutes,
        };
        persistDemoMeta(meta);
        return meta;
      }
    }

    clearDemoMeta();
  }

  return createDemoSession();
}

export function useDemoMode() {
  const demoMeta = useSyncExternalStore(subscribeDemoMeta, readDemoMeta, () => null);
  const [hasDemoQuery, setHasDemoQuery] = useState(false);

  useEffect(() => {
    if (!hasStorage()) return;

    const syncQuery = () => {
      const params = new URLSearchParams(window.location.search);
      setHasDemoQuery(params.get("demo") === "true");
    };

    syncQuery();
    window.addEventListener("popstate", syncQuery);

    return () => {
      window.removeEventListener("popstate", syncQuery);
    };
  }, []);

  useEffect(() => {
    // Tidak ada ?demo=true DAN tidak ada sesi tersimpan → skip
    if (!hasDemoQuery && !demoMeta?.sessionKey) return;

    // Sudah ada sesi di localStorage tapi tidak ada ?demo=true →
    // biarkan saja, timer tetap jalan di halaman manapun
    if (!hasDemoQuery && demoMeta?.sessionKey) return;

    let cancelled = false;

    const load = async () => {
      const nextMeta = await ensureDemoSession(demoMeta?.sessionKey);
      if (cancelled) return;

      if (nextMeta) {
        persistDemoMeta(nextMeta);
      } else {
        clearDemoMeta();
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [demoMeta?.sessionKey, hasDemoQuery]);

  // isDemoMode aktif selama ada sessionKey di localStorage
  const isDemoMode = Boolean(demoMeta?.sessionKey) || hasDemoQuery;

  return {
    isDemoMode,
    demoMeta,
    demoStoreId: demoMeta?.storeId ?? "",
    demoUserId: demoMeta?.userId ?? "",
    setDemoMeta: (meta: DemoMeta | null) => {
      if (meta) {
        persistDemoMeta(meta);
      } else {
        clearDemoMeta();
      }
    },
  };
}
