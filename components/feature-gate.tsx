"use client";

import Link from "next/link";
import { canAccessFeature, getPlanLabel, type FeatureKey } from "@/lib/subscription-plan";
import { useSubscriptionPlan } from "@/lib/use-subscription-plan";

export default function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
}) {
  const { plan, loading } = useSubscriptionPlan();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm text-gray-500 shadow-sm">
          Memeriksa akses fitur...
        </div>
      </div>
    );
  }

  if (canAccessFeature(plan, feature)) {
    return <>{children}</>;
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md rounded-3xl border border-amber-100 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Fitur Terkunci</p>
        <h1 className="mt-3 text-2xl font-black text-slate-900">Upgrade paket diperlukan</h1>
        <p className="mt-2 text-sm text-slate-500">
          Paket akun kamu saat ini <span className="font-bold text-slate-700">{getPlanLabel(plan)}</span>.
          Fitur ini hanya tersedia pada paket yang lebih tinggi.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
