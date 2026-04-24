"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useDemoMode, clearDemoMeta } from "@/lib/demo";
import { canAccessFeature, getPlanLabel, type FeatureKey } from "@/lib/subscription-plan";
import { useSubscriptionPlan } from "@/lib/use-subscription-plan";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    feature: "dashboard" as FeatureKey,
    icon: (
      <>
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" />
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" />
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" />
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Kasir",
    href: "/kasir",
    feature: "kasir" as FeatureKey,
    icon: (
      <>
        <rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" />
        <path d="M8 8v2M6 9h4" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Produk",
    href: "/product",
    feature: "produk" as FeatureKey,
    icon: (
      <>
        <path d="M8 2L14 5v6L8 14 2 11V5z" stroke="currentColor" />
        <path d="M8 2v12M2 5l6 3 6-3" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Supplier",
    href: "/suppliers",
    feature: "supplier" as FeatureKey,
    icon: (
      <>
        <path d="M3 13v-1a2 2 0 012-2h6a2 2 0 012 2v1" stroke="currentColor" />
        <circle cx="8" cy="5" r="2.5" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Laporan",
    href: "/laporan",
    feature: "laporan" as FeatureKey,
    icon: (
      <>
        <path d="M2 13V6l3-3 3 3 3-2 3 2v7M2 13h12" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Shift",
    href: "/shifts",
    feature: "shift" as FeatureKey,
    icon: (
      <>
        <circle cx="8" cy="8" r="6" stroke="currentColor" />
        <path d="M8 4v4l2 2" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Laporan Shift",
    href: "/laporans",
    feature: "laporan_shift" as FeatureKey,
    icon: (
      <>
        <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" />
        <path d="M5 5h6M5 7.5h6M5 10h4" stroke="currentColor" strokeLinecap="round" />
      </>
    ),
  },
  {
    label: "Promo",
    href: "/promo",
    feature: "promo" as FeatureKey,
    icon: (
      <>
        <path d="M3 6.5V4.5A1.5 1.5 0 014.5 3h7A1.5 1.5 0 0113 4.5v2" stroke="currentColor" />
        <path d="M2.5 6.5h11A1.5 1.5 0 0115 8v1a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 9V8a1.5 1.5 0 011.5-1.5z" stroke="currentColor" />
        <path d="M8 3v7.5" stroke="currentColor" />
        <path d="M6.2 4.7c0 .7.8 1.3 1.8 1.3s1.8.6 1.8 1.3S9 8.6 8 8.6 6.2 8 6.2 7.3" stroke="currentColor" strokeLinecap="round" />
      </>
    ),
  },
  {
    label: "Booking",
    href: "/booking",
    feature: "booking" as FeatureKey,
    icon: (
      <>
        <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" />
        <path d="M2 6h12" stroke="currentColor" />
        <path d="M5 2v2M11 2v2" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Aset Booking",
    href: "/booking/resources",
    feature: "booking_resources" as FeatureKey,
    icon: (
      <>
        <rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" />
        <path d="M6 4v8M10 4v8" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Pengaturan Booking",
    href: "/booking/settings",
    feature: "booking_settings" as FeatureKey,
    icon: (
      <>
        <circle cx="8" cy="8" r="2" stroke="currentColor" />
        <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M12.5 3.5L11 5M5 11l-1.5 1.5" stroke="currentColor" />
      </>
    ),
  },
];

const hiddenOn = ["/", "/home", "/login", "/register", "/admin/activate"];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isDemoMode } = useDemoMode();
  const { plan, loading } = useSubscriptionPlan();

  if (hiddenOn.includes(pathname) || pathname.startsWith("/book/")) return null;

  const email = session?.user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase() || "??";
  const withMode = (href: string) => (isDemoMode ? `${href}?demo=true` : href);
  const visibleNavItems = loading
    ? navItems.filter((nav) => ["dashboard", "kasir", "produk"].includes(nav.feature))
    : navItems.filter((nav) => canAccessFeature(plan, nav.feature));

  return (
    <aside className="group flex h-full w-16 flex-shrink-0 flex-col overflow-hidden border-r border-gray-100 bg-white px-3 py-4 transition-[width] duration-300 ease-out hover:w-56">

      {/* Logo */}
      <Link
        href={withMode("/dashboard")}
        className="mb-3 flex flex-shrink-0 items-center gap-3 rounded-xl px-2 py-1.5"
        title="KasirKu"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-700 shadow-sm">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path d="M4 12c0-3 1.5-5 4-5s4 2 4 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="8" cy="12.5" rx="4" ry="1.5" stroke="white" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="min-w-0 -translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
          <p className="whitespace-nowrap text-sm font-semibold text-gray-900">KasirKu</p>
          <p className="whitespace-nowrap text-[11px] text-gray-400">Pilih halaman dari sidebar</p>
        </div>
      </Link>

      {/* Nav items — scrollable */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto [&::-webkit-scrollbar]:hidden">
        {visibleNavItems.map((nav) => {
          const isActive = pathname === nav.href;
          return (
            <Link
              key={nav.label}
              href={withMode(nav.href)}
              title={nav.label}
              className={`flex flex-shrink-0 items-center gap-3 rounded-xl px-2 py-2.5 transition-all ${
                isActive
                  ? "bg-amber-50 text-amber-800"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" strokeWidth={1.5}>
                  {nav.icon}
                </svg>
              </span>
              <span className="whitespace-nowrap text-sm font-medium -translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                {nav.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer — selalu nempel di bawah */}
      <div className="mt-2 flex flex-shrink-0 flex-col gap-1 border-t border-gray-100 pt-2">
        {isDemoMode ? (
          <Link
            href="/home"
            onClick={() => clearDemoMeta()}
            title="Keluar Demo"
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" strokeWidth={1.5}>
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeLinecap="round" />
                <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="whitespace-nowrap text-sm font-medium -translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              Keluar Demo
            </span>
          </Link>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Keluar"
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" strokeWidth={1.5}>
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeLinecap="round" />
                <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="whitespace-nowrap text-sm font-medium -translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              Keluar
            </span>
          </button>
        )}

        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <div
            title={isDemoMode ? "Akun Demo" : email}
            className="flex h-8 w-8 flex-shrink-0 cursor-default select-none items-center justify-center rounded-full bg-amber-100 text-[10px] font-medium text-amber-800"
          >
            {isDemoMode ? "DM" : initials}
          </div>
          <div className="min-w-0 -translate-x-2 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
            <p className="whitespace-nowrap text-xs font-medium text-gray-700">{isDemoMode ? "Akun Demo" : initials}</p>
            <p className="max-w-[140px] truncate text-[11px] text-gray-400">
              {isDemoMode ? "Mode percobaan aktif" : email}
            </p>
            <p className="mt-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-amber-700">
              {isDemoMode ? "Plan Ultra" : `Plan ${getPlanLabel(plan)}`}
            </p>
          </div>
        </div>
      </div>

    </aside>
  );
}
