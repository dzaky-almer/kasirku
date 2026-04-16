"use client";

import { useState, useEffect } from "react";

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
  // 1. FIX HYDRATION: State untuk memastikan client-side rendering
  const [mounted, setMounted] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [plan, setPlan] = useState("pro");
  const [tier, setTier] = useState("monthly");
  const [quantity, setQuantity] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedCode[]>([]);
  const [error, setError] = useState("");

  const [loadingCodes, setLoadingCodes] = useState(false);
  const [unusedCodes, setUnusedCodes] = useState<UnusedCode[]>([]);
  const [copyNotice, setCopyNotice] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadCodes() {
    setLoadingCodes(true);
    setAuthError("");
    try {
      const res = await fetch("/api/referral/generate?filter=unused", {
        headers: { "x-admin-secret": adminSecret },
      });
      const data = await res.json();
      if (res.status === 401) {
        setIsAuthed(false);
        setAuthError("Admin secret salah atau belum cocok dengan nilai di .env");
        return;
      }
      if (res.ok) setUnusedCodes(data.codes);
    } catch {
      console.error("Gagal memuat kode");
    } finally {
      setLoadingCodes(false);
    }
  }

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!adminSecret.trim()) {
      setAuthError("Masukkan admin secret");
      return;
    }
    setIsAuthed(true);
    // Kita panggil loadCodes nanti setelah state isAuthed benar-benar berubah
  }

  // Trigger load codes saat berhasil auth
  useEffect(() => {
    if (isAuthed) {
      loadCodes();
    }
  }, [isAuthed]);

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
        body: JSON.stringify({ plan, tier, quantity, expiresInDays }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthed(false);
          setAuthError("Admin secret salah atau belum cocok dengan nilai di .env");
          return;
        }
        setError(data.error ?? "Gagal generate kode");
        return;
      }

      const codes = Array.isArray(data.codes) ? data.codes : [data.codes];
      const templates = Array.isArray(data.waPesanTemplate)
        ? data.waPesanTemplate
        : [data.waPesanTemplate];

      const newResults: GeneratedCode[] = codes.map(
        (code: string, i: number) => ({
          code,
          plan: data.plan,
          tier: data.tier,
          durationDays: data.durationDays,
          waPesanTemplate: templates[i] ?? templates[0],
        }),
      );

      setResults(newResults);
      loadCodes();
    } catch {
      setError("Terjadi kesalahan server.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyToClipboard(text: string, label = "Kode berhasil disalin") {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(label);
    } catch {
      setCopyNotice("Gagal menyalin. Coba lagi.");
    }
  }

  useEffect(() => {
    if (!copyNotice) return;

    const timer = window.setTimeout(() => {
      setCopyNotice("");
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [copyNotice]);

  // JANGAN RENDER APAPUN sebelum mounted agar sinkron dengan server
  if (!mounted) return <div className="flex-1 bg-slate-50" />;

  // RENDER FORM LOGIN (AUTH GATE)
  if (!isAuthed) {
    return (
      <div className="flex-1 bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔐</div>
            <h1 className="text-xl font-black text-slate-900">
              Admin Activation
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Masukkan Admin Secret TokoKu
            </p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              placeholder="••••••••••••"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl outline-none focus:border-amber-400 text-black text-center font-mono"
            />
            {authError && (
              <p className="text-[10px] text-red-500 text-center">
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition"
            >
              Buka Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // RENDER DASHBOARD UTAMA
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-6 text-slate-900">
      {copyNotice && (
        <div className="fixed top-5 right-5 z-50 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-slate-900/20">
          {copyNotice}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Admin — Aktivasi Akun</h1>
            <p className="text-sm text-slate-400">
              Buat kode akses untuk user berbayar
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
              Terautentikasi
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Form Generate */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-black mb-5">Konfigurasi Kode</h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">
                    Paket
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["starter", "pro", "ultra"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlan(p)}
                        className={`py-2 rounded-xl text-xs font-bold border transition capitalize ${plan === p ? "bg-amber-600 text-white border-amber-600" : "bg-slate-50 text-slate-400 border-slate-100"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">
                    Jumlah
                  </label>
                  <input
                    type="number"
                    value={isNaN(quantity) ? "" : quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 block">
                    Exp (Hari)
                  </label>
                  <input
                    type="number"
                    value={isNaN(expiresInDays) ? "" : expiresInDays}
                    onChange={(e) =>
                      setExpiresInDays(parseInt(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={generating}
                className="w-full py-3 bg-amber-600 text-white rounded-xl font-black hover:bg-amber-700 transition"
              >
                {generating ? "Proses..." : `⚡ Generate ${quantity} Kode`}
              </button>
            </form>
          </div>

          {/* List Kode */}
          <div className="space-y-4">
            {results.map((r, i) => (
              <div
                key={i}
                className="bg-white border-2 border-amber-100 rounded-2xl p-4 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-amber-100 px-3 py-1 text-[9px] font-bold text-amber-800 rounded-bl-xl uppercase">
                  Baru
                </div>
                <code className="text-xl font-black text-amber-700 block mb-2">
                  {r.code}
                </code>
                <button
                  onClick={() => copyToClipboard(r.code, "Kode referral berhasil disalin")}
                  className="text-[10px] bg-slate-900 text-white px-3 py-1 rounded-lg"
                >
                  Copy Kode
                </button>
              </div>
            ))}

            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-sm">Kode Belum Digunakan</h3>
                <button
                  onClick={loadCodes}
                  className="text-[10px] text-amber-600 font-bold uppercase"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {unusedCodes.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <code className="text-xs font-bold text-slate-600">
                      {c.code}
                    </code>
                    <span className="text-[9px] font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-500 uppercase">
                      {c.plan}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
