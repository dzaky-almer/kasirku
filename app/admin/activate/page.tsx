"use client";

// ============================================================
// LOKASI: app/admin/activate/page.tsx
// AKSES: Hanya admin — dilindungi password di frontend
// URL: /admin/activate
// ============================================================

import { useState } from "react";

interface GeneratedCode {
  code: string;
  plan: string;
  tier: string;
  durationDays: number;
  waPesanTemplate: string;
}

interface UnusedCode {
  id: string;
  code: string;
  plan: string;
  tier: string;
}

export default function AdminActivatePage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  // Form generate kode
  const [plan, setPlan] = useState("pro");
  const [tier, setTier] = useState("monthly");
  const [quantity, setQuantity] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7); // kode expired dalam 7 hari

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedCode[]>([]);
  const [error, setError] = useState("");

  // Daftar kode
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [unusedCodes, setUnusedCodes] = useState<UnusedCode[]>([]);

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    // Validasi secret di client side (ini hanya untuk UI)
    // Validasi asli ada di API
    if (!adminSecret.trim()) {
      setAuthError("Masukkan admin secret");
      return;
    }
    setIsAuthed(true);
    loadCodes();
  }

  async function loadCodes() {
    setLoadingCodes(true);
    try {
      const res = await fetch("/api/referral/generate?filter=unused", {
        headers: { "x-admin-secret": adminSecret },
      });
      const data = await res.json();
      if (res.ok) setUnusedCodes(data.codes);
    } catch {}
    setLoadingCodes(false);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGenerating(true);

    try {
      const res = await fetch("/api/referral/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          plan,
          tier,
          quantity,
          expiresInDays,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal generate kode");
        return;
      }

      // Handle single atau multiple codes
      const codes = Array.isArray(data.codes) ? data.codes : [data.codes];
      const templates = Array.isArray(data.waPesanTemplate)
        ? data.waPesanTemplate
        : [data.waPesanTemplate];

      const newResults: GeneratedCode[] = codes.map((code: string, i: number) => ({
        code,
        plan: data.plan,
        tier: data.tier,
        durationDays: data.durationDays,
        waPesanTemplate: templates[i] ?? templates[0],
      }));

      setResults(newResults);
      loadCodes(); // Refresh list
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const planColor: Record<string, string> = {
    starter: "bg-slate-100 text-slate-700 border-slate-200",
    pro: "bg-amber-100 text-amber-800 border-amber-200",
    ultra: "bg-purple-100 text-purple-800 border-purple-200",
  };

  // ── AUTH GATE ─────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-lg font-black text-slate-900">Admin Panel</h1>
            <p className="text-sm text-slate-400 mt-1">TokoKu — Aktivasi Langganan</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Admin Secret</label>
              <input
                type="password"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:border-amber-400 transition text-black"
              />
              {authError && <p className="text-xs text-red-500 mt-1">{authError}</p>}
            </div>
            <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition">
              Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── MAIN PANEL ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Admin — Aktivasi Akun</h1>
            <p className="text-sm text-slate-400">Generate kode referral untuk user yang sudah bayar</p>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-bold">✓ Terautentikasi</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">

          {/* Form Generate */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-black text-slate-900 mb-5">Generate Kode Referral</h2>
            <form onSubmit={handleGenerate} className="space-y-4">

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Paket</label>
                <div className="grid grid-cols-3 gap-2">
                  {["starter", "pro", "ultra"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlan(p)}
                      className={`py-2 rounded-xl text-xs font-bold border transition capitalize ${
                        plan === p ? planColor[p] : "bg-slate-50 text-slate-400 border-slate-100"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Periode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["monthly", "Bulanan"], ["yearly", "Tahunan"]].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTier(val)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        tier === val ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-400 border-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Jumlah Kode</label>
                  <input
                    type="number" min={1} max={50} value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-amber-400 text-black"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Kode Expired (hari)</label>
                  <input
                    type="number" min={1} value={expiresInDays}
                    onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-amber-400 text-black"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Waktu kode bisa dipakai</p>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

              <button
                type="submit"
                disabled={generating}
                className="w-full py-3 bg-amber-700 text-white rounded-xl font-black hover:bg-amber-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  `⚡ Generate ${quantity} Kode`
                )}
              </button>
            </form>
          </div>

          {/* Hasil Generate */}
          <div className="space-y-4">
            {results.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h2 className="font-black text-slate-900 mb-4">✅ Kode Berhasil Dibuat</h2>
                <div className="space-y-4">
                  {results.map((r, i) => (
                    <div key={i} className="border border-slate-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <code className="font-mono text-lg font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-lg">
                          {r.code}
                        </code>
                        <button
                          onClick={() => copyToClipboard(r.code)}
                          className="text-xs text-slate-500 hover:text-amber-700 border border-slate-200 px-3 py-1 rounded-lg hover:border-amber-300 transition"
                        >
                          Copy Kode
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${planColor[r.plan]}`}>
                          {r.plan}
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {r.tier === "yearly" ? "Tahunan" : "Bulanan"}
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          {r.durationDays} hari
                        </span>
                      </div>
                      {/* Pesan WA siap kirim */}
                      <div className="bg-slate-50 rounded-xl p-3 relative">
                        <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Pesan WA (siap kirim):</p>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                          {r.waPesanTemplate}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(r.waPesanTemplate)}
                          className="absolute top-2 right-2 text-[10px] text-slate-400 hover:text-amber-700 border border-slate-200 px-2 py-1 rounded-lg hover:border-amber-300 transition bg-white"
                        >
                          Copy Pesan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kode yang belum dipakai */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-slate-900">Kode Belum Dipakai</h2>
                <button onClick={loadCodes} className="text-xs text-amber-700 font-bold hover:underline">
                  Refresh
                </button>
              </div>
              {loadingCodes ? (
                <p className="text-xs text-slate-400">Memuat...</p>
              ) : unusedCodes.length === 0 ? (
                <p className="text-xs text-slate-400">Tidak ada kode aktif.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {unusedCodes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50">
                      <code className="font-mono text-sm font-bold text-slate-700">{c.code}</code>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${planColor[c.plan] ?? "bg-slate-100 text-slate-600"}`}>
                          {c.plan}
                        </span>
                        <button
                          onClick={() => copyToClipboard(c.code)}
                          className="text-[10px] text-slate-400 hover:text-amber-700 transition"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
