"use client";

import { useEffect, useState } from "react";

export function useAsyncData<T>(loader: (() => Promise<T>) | null, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(loader));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!loader) {
      setLoading(false);
      return;
    }

    let active = true;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const result = await loader();
        if (!active) return;
        setData(result);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, deps);

  return { data, loading, error, setData, setError };
}
