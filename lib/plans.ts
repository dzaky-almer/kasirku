export const PLANS = ["BASIC", "PRO", "ULTRA"] as const;

export type Plan = (typeof PLANS)[number];

export const FEATURES = [
  "dashboard",
  "kasir",
  "produk",
  "supplier",
  "shift",
  "booking",
  "laporan_produk",
  "laporan_shift",
] as const;

export type Feature = (typeof FEATURES)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  BASIC: "Basic",
  PRO: "Pro",
  ULTRA: "Ultra",
};

export const FEATURE_LABELS: Record<Feature, string> = {
  dashboard: "Dashboard",
  kasir: "Kasir",
  produk: "Produk",
  supplier: "Supplier",
  shift: "Shift",
  booking: "Booking",
  laporan_produk: "Laporan Produk",
  laporan_shift: "Laporan Shift",
};

export const FEATURE_REQUIRED_PLAN: Record<Feature, Plan> = {
  dashboard: "BASIC",
  kasir: "BASIC",
  produk: "BASIC",
  supplier: "PRO",
  shift: "PRO",
  booking: "ULTRA",
  laporan_produk: "PRO",
  laporan_shift: "ULTRA",
};

export const PLAN_FEATURES: Record<Plan, readonly Feature[]> = {
  BASIC: ["dashboard", "kasir", "produk"],
  PRO: ["dashboard", "kasir", "produk", "supplier", "shift", "laporan_produk"],
  ULTRA: [
    "dashboard",
    "kasir",
    "produk",
    "supplier",
    "shift",
    "booking",
    "laporan_produk",
    "laporan_shift",
  ],
};

export function normalizePlan(plan?: string | null): Plan {
  if (plan === "PRO" || plan === "ULTRA") return plan;
  return "BASIC";
}

export function resolveEffectivePlan(plan?: string | null, expiresAt?: Date | string | null): Plan {
  const normalizedPlan = normalizePlan(plan);
  if (normalizedPlan === "BASIC" || !expiresAt) return normalizedPlan;

  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return normalizedPlan;

  return expiry.getTime() < Date.now() ? "BASIC" : normalizedPlan;
}

export function hasAccess(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

export function getRequiredPlan(feature: Feature): Plan {
  return FEATURE_REQUIRED_PLAN[feature];
}
