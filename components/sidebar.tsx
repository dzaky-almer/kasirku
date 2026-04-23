"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useDemoMode, clearDemoMeta } from "@/lib/demo";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
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
    icon: (
      <>
        <path d="M2 13V6l3-3 3 3 3-2 3 2v7M2 13h12" stroke="currentColor" />
      </>
    ),
  },
  {
    label: "Shift",
    href: "/shifts",
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
    icon: (
      <>
        <path d="M2 13V6l3-3 3 3 3-2 3 2v7M2 13h12" stroke="currentColor" />
      </>
    )
  },
  {
    label: "promo",
    href: "/promo",
    icon: (
      <>
        <path d="M2 13V6l3-3 3 3 3-2 3 2v7M2 13h12" stroke="currentColor" />
      </>
    )
  },
  {
    label: "Booking",
    href: "/booking",
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

  if (hiddenOn.includes(pathname) || pathname.startsWith("/book/")) return null;

  // Ambil 2 huruf pertama dari email untuk avatar
  const email = session?.user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase() || "??";
  const withMode = (href: string) => (isDemoMode ? `${href}?demo=true` : href);

  return (
    <aside className="w-14 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-1 flex-shrink-0">
      {/* Logo */}
      <Link
        href={withMode("/dashboard")}
        className="w-8 h-8 bg-amber-700 rounded-lg flex items-center justify-center mb-3"
        title="Kopi Nusantara"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
          <path d="M4 12c0-3 1.5-5 4-5s4 2 4 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M6 7V5a2 2 0 0 1 4 0v2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <ellipse cx="8" cy="12.5" rx="4" ry="1.5" stroke="white" strokeWidth="1.2" />
        </svg>
      </Link>

      {/* Nav items */}
      {navItems.map((nav) => {
        const isActive = pathname === nav.href;
        return (
          <Link
            key={nav.label}
            href={withMode(nav.href)}
            title={nav.label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isActive
              ? "bg-amber-50 text-amber-800"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
              {nav.icon}
            </svg>
          </Link>
        );
      })}

      <div className="flex-1" />

      {/* Logout */}
      {isDemoMode ? (
        <Link
          href="/home"
          onClick={() => clearDemoMeta()}
          title="Keluar Demo"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors mb-2"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
            <path
              d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3"
              stroke="currentColor"
              strokeLinecap="round"
            />
            <path
              d="M10 11l3-3-3-3M13 8H6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : (
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Keluar"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors mb-2"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" strokeWidth={1.5}>
            <path
              d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3"
              stroke="currentColor"
              strokeLinecap="round"
            />
            <path
              d="M10 11l3-3-3-3M13 8H6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Avatar — inisial dari email */}
      <div
        title={isDemoMode ? "Akun Demo" : email}
        className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-medium text-amber-800 cursor-default select-none"
      >
        {isDemoMode ? "DM" : initials}
      </div>
    </aside>
  );
}
