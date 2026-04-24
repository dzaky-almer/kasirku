"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useDemoMode } from "@/lib/demo";
import { normalizePlan, type SubscriptionPlan } from "@/lib/subscription-plan";

interface SessionUser {
  id?: string;
}

export function useSubscriptionPlan() {
  const { data: session, status } = useSession();
  const { isDemoMode } = useDemoMode();
  const sessionUser = (session?.user ?? {}) as SessionUser;
  const userId = sessionUser.id ?? "";

  const [plan, setPlan] = useState<SubscriptionPlan>("basic");
  const [loadedUserId, setLoadedUserId] = useState("");

  useEffect(() => {
    if (isDemoMode || status === "loading" || !userId) return;

    let cancelled = false;

    fetch(`/api/subscription?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPlan(normalizePlan(data?.plan));
        setLoadedUserId(userId);
      })
      .catch(() => {
        if (cancelled) return;
        setPlan("basic");
        setLoadedUserId(userId);
      });

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, status, userId]);

  const resolvedPlan: SubscriptionPlan = isDemoMode ? "ultra" : userId ? plan : "basic";
  const resolvedLoading = isDemoMode ? false : status === "loading" ? true : userId ? loadedUserId !== userId : false;

  return {
    plan: resolvedPlan,
    loading: resolvedLoading,
  };
}
