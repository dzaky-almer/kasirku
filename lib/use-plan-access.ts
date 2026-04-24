"use client";

import { useSession } from "next-auth/react";
import { useDemoMode } from "@/lib/demo";
import {
  getRequiredPlan,
  hasAccess,
  resolveEffectivePlan,
  type Feature,
  type Plan,
} from "@/lib/plans";

type SessionUserPlan = {
  storePlan?: Plan;
  storePlanExpiresAt?: string | null;
};

export function usePlanAccess(feature: Feature) {
  const { data: session, status } = useSession();
  const { isDemoMode } = useDemoMode();
  const sessionUser = (session?.user ?? {}) as SessionUserPlan;

  const plan = isDemoMode
    ? "ULTRA"
    : resolveEffectivePlan(sessionUser.storePlan, sessionUser.storePlanExpiresAt);
  const requiredPlan = getRequiredPlan(feature);

  return {
    loading: status === "loading" && !isDemoMode,
    plan,
    requiredPlan,
    hasFeatureAccess: hasAccess(plan, feature),
  };
}
