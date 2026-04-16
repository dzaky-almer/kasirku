"use client";

// ============================================================
// LOKASI: app/login/page.tsx
// REPLACE file lama dengan ini
// ============================================================

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Email atau password salah.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/home" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 bg-amber-700 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-white"
                fill="none"
                strokeWidth={2}
              >
                <path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-xl font-black">
              <span className="text-amber-700">Toko</span>
              <span className="text-slate-900">Ku</span>
            </span>
          </Link>
          <p className="text-sm text-slate-400 mt-2">Masuk ke akun toko kamu</p>
        </div>

        {/* Notif setelah register */}
        {justRegistered && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-2xl mb-4 text-center font-medium">
            🎉 Akun berhasil dibuat! Silakan login.
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/80 p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@gmail.com"
                required
                className="w-full px-4 py-3 text-sm border text-black border-slate-200 rounded-2xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 text-sm border text-black border-slate-200 rounded-2xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div>
                <p className="text-xs text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-amber-700 text-white font-black rounded-2xl hover:bg-amber-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Masuk...
                </>
              ) : (
                "Masuk"
              )}
            </button>
          </form>

          <div className="mt-5 space-y-3">
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-slate-100" />
              <span className="px-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                atau
              </span>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            {/* Demo button */}
            <Link
              href="/dashboard?demo=true"
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-sm font-bold hover:bg-amber-100 transition"
            >
              ▶ Coba Akun Demo (tanpa login)
            </Link>
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="text-amber-700 font-bold hover:underline"
            >
              Daftar Sekarang
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          <Link href="/home" className="hover:text-amber-700 transition">
            ← Kembali ke Beranda
          </Link>
        </p>
      </div>
    </div>
  );
}
