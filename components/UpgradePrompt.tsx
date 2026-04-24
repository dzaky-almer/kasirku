"use client";

import { PLAN_LABELS } from "@/lib/plans";

type UpgradePromptProps = {
  requiredPlan: "PRO" | "ULTRA";
  featureName: string;
};

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M8 1.5l1.5 4L14 7l-4.5 1.5L8 12.5l-1.5-4L2 7l4.5-1.5L8 1.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function UpgradePrompt({ requiredPlan, featureName }: UpgradePromptProps) {
  const planLabel = PLAN_LABELS[requiredPlan];

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-lg">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-700 text-white">
          <SparkIcon />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{featureName} terkunci</p>
          <p className="text-xs text-gray-500">Fitur ini tersedia di paket {planLabel}.</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-100 bg-white/80 p-4">
        <p className="text-sm text-gray-700">
          Upgrade paket untuk membuka akses ke <span className="font-semibold text-gray-900">{featureName}</span> dan fitur premium lainnya.
        </p>
      </div>

      <button
        type="button"
        onClick={() => window.alert(`Hubungi tim KasirKu untuk upgrade ke paket ${planLabel}.`)}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-800"
      >
        Upgrade ke {planLabel}
      </button>
    </div>
  );
}
