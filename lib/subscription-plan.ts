export type SubscriptionPlan = "basic" | "pro" | "ultra";

export type FeatureKey =
  | "dashboard"
  | "kasir"
  | "produk"
  | "supplier"
  | "shift"
  | "laporan"
  | "laporan_shift"
  | "promo"
  | "booking"
  | "booking_resources"
  | "booking_settings";

const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  basic: 1,
  pro: 2,
  ultra: 3,
};

const FEATURE_MIN_PLAN: Record<FeatureKey, SubscriptionPlan> = {
  dashboard: "basic",
  kasir: "basic",
  produk: "basic",
  supplier: "pro",
  shift: "pro",
  laporan: "pro",
  laporan_shift: "pro",
  promo: "pro",
  booking: "ultra",
  booking_resources: "ultra",
  booking_settings: "ultra",
};

export function normalizePlan(plan?: string | null): SubscriptionPlan {
  if (plan === "ultra") return "ultra";
  if (plan === "pro") return "pro";
  if (plan === "basic" || plan === "starter") return "basic";
  return "basic";
}

export function getPlanLabel(plan?: string | null): string {
  const normalized = normalizePlan(plan);
  if (normalized === "ultra") return "Ultra";
  if (normalized === "pro") return "Pro";
  return "Basic";
}

export function canAccessFeature(plan: string | null | undefined, feature: FeatureKey): boolean {
  const normalizedPlan = normalizePlan(plan);
  return PLAN_ORDER[normalizedPlan] >= PLAN_ORDER[FEATURE_MIN_PLAN[feature]];
}
