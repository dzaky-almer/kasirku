"use client";

// ============================================================
// LOKASI: app/register/page.tsx
// REPLACE file lama dengan ini
// ============================================================

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

type Step = 1 | 2 | 3;

interface ReferralInfo {
  valid: boolean;
  plan?: string;
  tier?: string;
  durationDays?: number;
  planLabel?: string;
  tierLabel?: string;
  message?: string;
  error?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill kode referral dari URL jika ada (?ref=TK-XXXX-XXXX)
  const refFromUrl = searchParams.get("ref") ?? "";

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1: Kode Referral ───────────────────────────────────
  const [referralCode, setReferralCode] = useState(refFromUrl.toUpperCase());
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  // ── Step 2: Data Akun ───────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");

  // ── Step 3: Data Toko + Midtrans ───────────────────────────
  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState("cafe");
  const [storeAddress, setStoreAddress] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [midtransServerKey, setMidtransServerKey] = useState("");
  const [midtransClientKey, setMidtransClientKey] = useState("");
  const [showMidtrans, setShowMidtrans] = useState(false);

  // Auto-check kode referral dari URL saat mount
  useEffect(() => {
    if (refFromUrl) {
      checkReferralCode(refFromUrl.toUpperCase());
    }
  }, [refFromUrl]);

  // Debounce check kode referral saat user ketik
  useEffect(() => {
    if (!referralCode || referralCode.length < 10) {
      setReferralInfo(null);
      return;
    }
    const t = setTimeout(() => checkReferralCode(referralCode), 600);
    return () => clearTimeout(t);
  }, [referralCode]);

  async function checkReferralCode(code: string) {
    if (!code.trim()) return;
    setCheckingCode(true);
    try {
      const res = await fetch(`/api/referral/validate?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      const data = await res.json();
      setReferralInfo(data);
    } catch {
      setReferralInfo({ valid: false, error: "Gagal cek kode. Coba lagi." });
    } finally {
      setCheckingCode(false);
    }
  }

  // ── Navigasi step ───────────────────────────────────────────
  function goToStep2() {
    if (!referralInfo?.valid) {
      setError("Masukkan kode referral yang valid terlebih dahulu.");
      return;
    }
    setError("");
    setStep(2);
  }

  function goToStep3() {
    if (!email || !password || !ownerName || !phone) {
      setError("Semua field wajib diisi.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password tidak cocok.");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    const phoneClean = phone.replace(/\D/g, "");
    if (!phoneClean.startsWith("62")) {
      setError("Nomor WA harus diawali 62 (contoh: 628123456789).");
      return;
    }
    setError("");
    // Auto-isi waNumber sama dengan phone kalau belum diisi
    if (!waNumber) setWaNumber(phone);
    setStep(3);
  }

  async function handleSubmit() {
    if (!storeName) {
      setError("Nama toko wajib diisi.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ownerName,
          phone: phone.replace(/\D/g, ""),
          referralCode: referralCode.trim().toUpperCase(),
          storeName,
          storeType,
          storeAddress: storeAddress || null,
          waNumber: waNumber ? waNumber.replace(/\D/g, "") : phone.replace(/\D/g, ""),
          midtransServerKey: midtransServerKey || null,
          midtransClientKey: midtransClientKey || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Registrasi gagal. Coba lagi.");
        setLoading(false);
        return;
      }

      // Auto login setelah register berhasil
      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      setLoading(false);

      if (login?.error) {
        // Register sukses tapi login gagal — arahkan ke login manual
        router.push("/login?registered=1");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  }

  // ── Plan badge color ─────────────────────────────────────────
  const planColor: Record<string, string> = {
    starter: "bg-slate-100 text-slate-700",
    pro: "bg-amber-100 text-amber-800",
    ultra: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-br from-amber-50 via-white to-orange-50/30 flex items-start justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/home" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 bg-amber-700 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" strokeWidth={2}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xl font-black">
              <span className="text-amber-700">Toko</span>
              <span className="text-slate-900">Ku</span>
            </span>
          </Link>
          <p className="text-sm text-slate-400 mt-2">Daftar akun baru</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                s === step ? "bg-amber-700 text-white scale-110 shadow-md" :
                s < step ? "bg-amber-200 text-amber-800" :
                "bg-slate-100 text-slate-400"
              }`}>
                {s < step ? "✓" : s}
              </div>
              <span className={`text-[10px] font-bold ${s === step ? "text-amber-700" : "text-slate-400"}`}>
                {s === 1 ? "Kode" : s === 2 ? "Akun" : "Toko"}
              </span>
            </div>
          ))}
          <div className="absolute left-0 right-0 h-0.5 bg-slate-100 -z-10 mx-8" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/80 p-8">

          {/* ── STEP 1: Kode Referral ─────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900 mb-1">Masukkan Kode Referral</h2>
                <p className="text-sm text-slate-400">
                  Kode dikirim admin via WhatsApp setelah kamu berlangganan.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-2 block uppercase tracking-wider">
                  Kode Referral
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="TK-XXXX-XXXX"
                  maxLength={12}
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition font-mono text-center text-lg tracking-widest font-bold text-black"
                />

                {/* Status kode */}
                <div className="mt-2 min-h-[24px]">
                  {checkingCode && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 border-2 border-amber-300 border-t-amber-700 rounded-full animate-spin" />
                      Mengecek kode...
                    </p>
                  )}
                  {!checkingCode && referralInfo?.valid && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${planColor[referralInfo.plan ?? "starter"]}`}>
                      ✓ {referralInfo.message}
                    </div>
                  )}
                  {!checkingCode && referralInfo && !referralInfo.valid && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      ✗ {referralInfo.error}
                    </p>
                  )}
                </div>
              </div>

              {/* Info: cara dapat kode */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-amber-800">Belum punya kode?</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Pilih paket di halaman beranda → hubungi admin via WhatsApp → setelah pembayaran, admin akan kirimkan kode referral kamu.
                </p>
                <a
                  href="/home#harga"
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 transition"
                >
                  Lihat paket harga →
                </a>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

              <button
                onClick={goToStep2}
                disabled={!referralInfo?.valid}
                className="w-full py-3.5 bg-amber-700 text-white rounded-2xl font-black hover:bg-amber-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Lanjutkan →
              </button>

              <p className="text-center text-xs text-slate-400">
                Sudah punya akun?{" "}
                <Link href="/login" className="text-amber-700 font-bold hover:underline">
                  Masuk
                </Link>
              </p>
            </div>
          )}

          {/* ── STEP 2: Data Akun ─────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black text-slate-900 mb-1">Data Akun</h2>
                <p className="text-sm text-slate-400">Email dan password untuk login ke TokoKu.</p>
              </div>

              {/* Paket aktif */}
              {referralInfo && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${planColor[referralInfo.plan ?? "starter"]}`}>
                  Paket: {referralInfo.planLabel} {referralInfo.tierLabel} ({referralInfo.durationDays} hari)
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Nama Pemilik Toko *</label>
                  <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Ahmad Fauzi"
                    className="w-full px-4 py-3 text-sm text-slate-900 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="kamu@gmail.com"
                    className="w-full px-4 py-3 text-sm text-slate-900 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">No. WhatsApp *</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="628123456789"
                    className="w-full px-4 py-3 text-sm text-slate-900 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Format: 628xxxxxxxxx (tanpa tanda +)</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Password * (min. 8 karakter)</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 text-sm text-slate-900 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Konfirmasi Password *</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                      className={`w-full px-4 py-3 text-sm text-slate-900 border rounded-2xl outline-none transition ${
                      confirmPassword && password !== confirmPassword
                        ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                        : "border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    }`}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[10px] text-red-500 mt-1">Password tidak cocok</p>
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => { setStep(1); setError(""); }}
                  className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition"
                >
                  ← Kembali
                </button>
                <button onClick={goToStep3}
                  className="flex-1 py-3 bg-amber-700 text-white rounded-2xl font-black hover:bg-amber-800 transition"
                >
                  Lanjutkan →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Data Toko ─────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black text-slate-900 mb-1">Data Toko</h2>
                <p className="text-sm text-slate-400">Info toko kamu yang akan tampil di sistem kasir.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Nama Toko *</label>
                  <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Barbershop Keren"
                    className="w-full px-4 py-3 text-sm text-slate-900 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Jenis Toko</label>
                    <select value={storeType} onChange={(e) => setStoreType(e.target.value)}
                      className="w-full px-4 py-3 text-sm text-slate-900 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 bg-white"
                    >
                      <option value="cafe">Cafe</option>
                      <option value="barbershop">Barbershop</option>
                      <option value="resto">Restoran</option>
                      <option value="warung">Warung</option>
                      <option value="toko">Toko</option>
                      <option value="salon">Salon</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">No. WA Toko</label>
                    <input type="tel" value={waNumber} onChange={(e) => setWaNumber(e.target.value)}
                      placeholder="628xxx"
                      className="w-full px-4 py-3 text-sm text-slate-900 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 transition font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Alamat Toko</label>
                  <input type="text" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="Jl. Contoh No. 1, Jakarta"
                    className="w-full px-4 py-3 text-sm text-slate-900 border border-slate-200 rounded-2xl outline-none focus:border-amber-400 transition"
                  />
                </div>

                {/* Midtrans — opsional, bisa diisi nanti di Settings */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowMidtrans(!showMidtrans)}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">💳</span>
                      Kunci Midtrans (opsional — untuk QRIS)
                    </span>
                    <span className={`transition-transform ${showMidtrans ? "rotate-180" : ""}`}>▼</span>
                  </button>

                  {showMidtrans && (
                    <div className="px-4 pb-4 space-y-3 bg-blue-50/50">
                      <p className="text-[10px] text-blue-600 leading-relaxed pt-2">
                        Dapatkan dari{" "}
                        <a href="https://midtrans.com" target="_blank" rel="noopener noreferrer" className="font-bold underline">
                          midtrans.com
                        </a>{" "}
                        → Settings → Access Keys. Bisa diisi nanti di Settings toko.
                      </p>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Server Key</label>
                        <input type="text" value={midtransServerKey} onChange={(e) => setMidtransServerKey(e.target.value)}
                          placeholder="SB-Mid-server-XXXXXXXX atau Mid-server-XXXXXXXX"
                          className="w-full px-3 py-2 text-xs text-slate-900 border border-blue-200 rounded-xl outline-none focus:border-amber-400 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Client Key</label>
                        <input type="text" value={midtransClientKey} onChange={(e) => setMidtransClientKey(e.target.value)}
                          placeholder="SB-Mid-client-XXXXXXXX atau Mid-client-XXXXXXXX"
                          className="w-full px-3 py-2 text-xs text-slate-900 border border-blue-200 rounded-xl outline-none focus:border-amber-400 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => { setStep(2); setError(""); }}
                  className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition"
                >
                  ← Kembali
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 py-3 bg-amber-700 text-white rounded-2xl font-black hover:bg-amber-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Membuat akun...
                    </>
                  ) : (
                    "Buat Akun 🎉"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
