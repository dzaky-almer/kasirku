"use client";

import UpgradePrompt from "@/components/UpgradePrompt";
import { usePlanAccess } from "@/lib/use-plan-access";
import type { Feature } from "@/lib/plans";

type PlanPageGateProps = {
  feature: Feature;
  featureName: string;
};

export function PlanPageGate({ feature, featureName }: PlanPageGateProps) {
  const { loading, hasFeatureAccess, requiredPlan } = usePlanAccess(feature);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
          Memeriksa akses paket...
        </div>
      </div>
    );
  }

  if (hasFeatureAccess) return null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <UpgradePrompt requiredPlan={requiredPlan} featureName={featureName} />
      </div>
    </div>
  );
}
