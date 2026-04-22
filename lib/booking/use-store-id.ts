"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useDemoMode } from "@/lib/demo";

export function useStoreIdentity() {
  const { data: session, status } = useSession();
  const { demoStoreId, isDemoMode } = useDemoMode();

  return useMemo(() => {
    const storeId = isDemoMode ? demoStoreId : ((session?.user as { storeId?: string } | undefined)?.storeId ?? "");
    return {
      storeId,
      isDemoMode,
      status,
      ready: status !== "loading" && Boolean(storeId),
    };
  }, [demoStoreId, isDemoMode, session, status]);
}
