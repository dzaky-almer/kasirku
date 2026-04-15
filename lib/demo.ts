'use client';

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

export function readDemoMeta(): DemoMeta | null {
  if (!hasStorage()) return null;

  const raw = window.localStorage.getItem(DEMO_META_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DemoMeta;
  } catch {
    window.localStorage.removeItem(DEMO_META_KEY);
    return null;
  }
}

export function persistDemoMeta(meta: DemoMeta) {
  if (!hasStorage()) return;
  window.localStorage.setItem(DEMO_SESSION_KEY, meta.sessionKey);
  window.localStorage.setItem(DEMO_META_KEY, JSON.stringify(meta));
}

export function clearDemoMeta() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(DEMO_SESSION_KEY);
  window.localStorage.removeItem(DEMO_META_KEY);
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
  const searchParams = useSearchParams();
  const [demoMeta, setDemoMeta] = useState<DemoMeta | null>(() => readDemoMeta());

  useEffect(() => {
    const hasDemoQuery = searchParams.get("demo") === "true";
    const storedMeta = readDemoMeta();

    if (!hasDemoQuery && !storedMeta?.sessionKey) return;

    let cancelled = false;

    const load = async () => {
      const nextMeta = await ensureDemoSession(storedMeta?.sessionKey);
      if (!cancelled) {
        setDemoMeta(nextMeta);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return {
    isDemoMode: searchParams.get("demo") === "true" || Boolean(demoMeta?.sessionKey),
    demoMeta,
    demoStoreId: demoMeta?.storeId ?? "",
    demoUserId: demoMeta?.userId ?? "",
    setDemoMeta: (meta: DemoMeta | null) => {
      if (meta) {
        persistDemoMeta(meta);
      } else {
        clearDemoMeta();
      }
      setDemoMeta(meta);
    },
  };
}
