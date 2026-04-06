"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState("cafe");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, storeName, storeType }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Registrasi gagal.");
      setLoading(false);
      return;
    }

    // Langsung login setelah register berhasil
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (login?.error) {
      setError("Registrasi berhasil tapi gagal login. Coba login manual.");
      router.push("/login");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" strokeWidth={1.5}>
              <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Kopi Nusantara</h1>
          <p className="text-sm text-gray-400 mt-1">Daftar akun baru</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-black">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@email.com"
                required
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Nama Toko</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Kopi Nusantara"
                required
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Jenis Toko</label>
              <select
                value={storeType}
                onChange={(e) => setStoreType(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-amber-400 transition-colors bg-white"
              >
                <option value="cafe">Cafe</option>
                <option value="resto">Restoran</option>
                <option value="warung">Warung</option>
                <option value="toko">Toko</option>
              </select>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-amber-700 text-white text-sm font-medium rounded-xl hover:bg-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Mendaftar..." : "Daftar"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-amber-700 hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}