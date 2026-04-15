"use client";

// ============================================================
// LOKASI: components/DemoExpiredPopup.tsx
//
// CARA PAKAI:
// Import di app/dashboard/page.tsx dan app/kasir/page.tsx:
//   import DemoExpiredPopup from '@/components/DemoExpiredPopup'
//   // Di dalam return JSX:
//   <DemoExpiredPopup />
//
// KONFIGURASI WAKTU DI .env:
//   NEXT_PUBLIC_DEMO_DURATION_HOURS=1   (default: 1 jam)
//   NEXT_PUBLIC_DEMO_DURATION_HOURS=0.1 (untuk testing: 6 menit)
// ============================================================

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ensureDemoSession, getDemoDurationMs, persistDemoMeta, readDemoMeta, useDemoMode } from "@/lib/demo";

// ── HOOK: useDemoTimer ─────────────────────────────────────────
export function useDemoTimer() {
  useSearchParams();
  const { isDemoMode } = useDemoMode();

  const [expired, setExpired] = useState(false);
  const [remainingMs, setRemainingMs] = useState(getDemoDurationMs());
  const [sessionKey, setSessionKey] = useState<string>("");

  useEffect(() => {
    if (!isDemoMode) return;

    const initSession = async () => {
      const meta = await ensureDemoSession(readDemoMeta()?.sessionKey);
      if (!meta) return;

      persistDemoMeta(meta);
      setSessionKey(meta.sessionKey);
      setRemainingMs(meta.remainingMs ?? getDemoDurationMs());
      setExpired(false);
    };

    void initSession();
  }, [isDemoMode]);

  // Countdown timer
  useEffect(() => {
    if (!isDemoMode || !sessionKey) return;

    const tick = setInterval(() => {
      setRemainingMs((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          setExpired(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [isDemoMode, sessionKey]);

  // Format waktu tersisa
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const timeLabel = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    isDemoMode,
    expired,
    remainingMs,
    timeLabel,
    sessionKey,
    resetSession: async () => {
      const meta = await ensureDemoSession(readDemoMeta()?.sessionKey);
      if (!meta) return;

      persistDemoMeta(meta);
      setSessionKey(meta.sessionKey);
      setRemainingMs(meta.remainingMs ?? getDemoDurationMs());
      setExpired(false);
    },
  };
}

// ── KOMPONEN: DemoTimerBanner ──────────────────────────────────
// Banner kecil di atas dashboard yang tampilkan countdown
export function DemoTimerBanner() {
  const { isDemoMode, timeLabel, remainingMs } = useDemoTimer();

  if (!isDemoMode) return null;

  const isWarning = remainingMs < 5 * 60 * 1000; // < 5 menit

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-xs font-bold ${
      isWarning
        ? "bg-red-500 text-white"
        : "bg-amber-600 text-white"
    }`}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span>MODE DEMO — Data akan direset otomatis</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm">⏱ {timeLabel}</span>
        <a
          href="/home#harga"
          className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition text-[10px] uppercase tracking-wider"
        >
          Berlangganan
        </a>
      </div>
    </div>
  );
}

// ── KOMPONEN: DemoExpiredPopup ─────────────────────────────────
// Popup fullscreen saat sesi demo habis
export default function DemoExpiredPopup() {
  const { isDemoMode, expired, resetSession } = useDemoTimer();
  const [resetting, setResetting] = useState(false);

  if (!isDemoMode || !expired) return null;

  const handleReset = async () => {
    setResetting(true);
    await resetSession();
    setResetting(false);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center shadow-2xl">
        <div className="text-6xl mb-4">⏰</div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Sesi Demo Selesai!</h2>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Waktu demo kamu sudah habis. Mau lanjut pakai TokoKu?
          <br />
          Berlangganan sekarang dan data kamu tersimpan permanen.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="/home#harga"
            className="w-full py-3.5 bg-amber-700 text-white rounded-2xl font-black hover:bg-amber-800 transition text-sm block"
          >
            🚀 Lihat Paket Berlangganan
          </a>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {resetting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Mereset...
              </>
            ) : (
              "↺ Reset Demo (data akan dihapus)"
            )}
          </button>

          <a href="/register"
            className="text-xs text-amber-700 font-bold hover:underline"
          >
            Punya kode referral? Daftar sekarang →
          </a>
        </div>

        <p className="text-[10px] text-slate-400 mt-4">
          Reset demo akan menghapus semua data yang dimasukkan selama sesi ini.
        </p>
      </div>
    </div>
  );
}
