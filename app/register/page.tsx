"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { clearDemoMeta } from "@/lib/demo";
import {
  normalizePhoneInput,
  validateRegistrationEmail,
  validateWhatsappNumber,
} from "@/lib/register-validation";

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
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50/30" />}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref") ?? "";

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState(refFromUrl.toUpperCase());
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeType, setStoreType] = useState("cafe");
  const [storeAddress, setStoreAddress] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [waNumberError, setWaNumberError] = useState("");
  const [midtransServerKey, setMidtransServerKey] = useState("");
  const [midtransClientKey, setMidtransClientKey] = useState("");
  const [showMidtrans, setShowMidtrans] = useState(false);

  useEffect(() => {
    if (refFromUrl) {
      void checkReferralCode(refFromUrl.toUpperCase());
    }
  }, [refFromUrl]);

  useEffect(() => {
    if (!referralCode || referralCode.length < 10) {
      setReferralInfo(null);
      return;
    }
    const t = setTimeout(() => void checkReferralCode(referralCode), 600);
    return () => clearTimeout(t);
  }, [referralCode]);

  async function checkReferralCode(code: string) {
    if (!code.trim()) return;
    setCheckingCode(true);
    try {
      const res = await fetch(`/api/referral/validate?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      const data = (await res.json()) as ReferralInfo;
      setReferralInfo(data);
    } catch {
      setReferralInfo({ valid: false, error: "Gagal cek kode. Coba lagi." });
    } finally {
      setCheckingCode(false);
    }
  }

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

    const emailValidation = validateRegistrationEmail(email);
    if (!emailValidation.valid || !emailValidation.normalized) {
      setEmailError(emailValidation.error ?? "Email tidak valid.");
      setError(emailValidation.error ?? "Email tidak valid.");
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

    const phoneValidation = validateWhatsappNumber(phone, "Nomor WhatsApp");
    if (!phoneValidation.valid || !phoneValidation.normalized) {
      setPhoneError(phoneValidation.error ?? "Nomor WhatsApp tidak valid.");
      setError(phoneValidation.error ?? "Nomor WhatsApp tidak valid.");
      return;
    }

    setEmail(emailValidation.normalized);
    setPhone(phoneValidation.normalized);
    setEmailError("");
    setPhoneError("");
    setError("");

    if (!waNumber) {
      setWaNumber(phoneValidation.normalized);
    }
    setStep(3);
  }

  async function handleSubmit() {
    if (!storeName) {
      setError("Nama toko wajib diisi.");
      return;
    }

    const emailValidation = validateRegistrationEmail(email);
    const phoneValidation = validateWhatsappNumber(phone, "Nomor WhatsApp");
    const waValidation = waNumber.trim()
      ? validateWhatsappNumber(waNumber, "No. WA toko")
      : { valid: true as const, normalized: phoneValidation.normalized ?? "" };

    if (!emailValidation.valid || !emailValidation.normalized) {
      setEmailError(emailValidation.error ?? "Email tidak valid.");
      setError(emailValidation.error ?? "Email tidak valid.");
      return;
    }

    if (!phoneValidation.valid || !phoneValidation.normalized) {
      setPhoneError(phoneValidation.error ?? "Nomor WhatsApp tidak valid.");
      setError(phoneValidation.error ?? "Nomor WhatsApp tidak valid.");
      return;
    }

    if (!waValidation.valid || !waValidation.normalized) {
      setWaNumberError(waValidation.error ?? "No. WA toko tidak valid.");
      setError(waValidation.error ?? "No. WA toko tidak valid.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValidation.normalized,
          password,
          ownerName,
          phone: phoneValidation.normalized,
          referralCode: referralCode.trim().toUpperCase(),
          storeName,
          storeType,
          storeAddress: storeAddress || null,
          waNumber: waValidation.normalized,
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

      clearDemoMeta();

      const login = await signIn("credentials", {
        email: emailValidation.normalized,
        password,
        redirect: false,
      });

      setLoading(false);
      if (login?.error) {
        router.push("/login?registered=1");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-br from-amber-50 via-white to-orange-50/30 flex items-start justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-md">
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
          <p className="text-sm text-slate-400 mt-2">Daftar akun baru untuk toko kamu</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/80 p-8 space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className={`h-2 flex-1 rounded-full ${item <= step ? "bg-amber-700" : "bg-slate-100"}`} />
            ))}
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Kode referral</span>
                <input
                  value={referralCode}
                  onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  placeholder="TK-XXXX-XXXX"
                />
              </label>
              {checkingCode ? <p className="text-sm text-slate-500">Memeriksa kode referral...</p> : null}
              {referralInfo?.error ? <p className="text-sm text-rose-600">{referralInfo.error}</p> : null}
              {referralInfo?.valid ? <p className="text-sm text-emerald-600">{referralInfo.message || "Kode referral valid."}</p> : null}
              <button
                onClick={goToStep2}
                disabled={!referralInfo?.valid}
                className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Lanjut
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Nama owner" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
              {emailError ? <p className="text-sm text-rose-600">{emailError}</p> : null}
              <input value={phone} onChange={(event) => setPhone(normalizePhoneInput(event.target.value))} placeholder="Nomor WhatsApp" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
              {phoneError ? <p className="text-sm text-rose-600">{phoneError}</p> : null}
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Konfirmasi password" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Kembali</button>
                <button onClick={goToStep3} className="flex-1 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Lanjut</button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <input value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Nama toko" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
              <input value={storeType} onChange={(event) => setStoreType(event.target.value)} placeholder="Tipe toko" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
              <textarea value={storeAddress} onChange={(event) => setStoreAddress(event.target.value)} placeholder="Alamat toko" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" rows={3} />
              <input value={waNumber} onChange={(event) => setWaNumber(normalizePhoneInput(event.target.value))} placeholder="No. WA toko" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
              {waNumberError ? <p className="text-sm text-rose-600">{waNumberError}</p> : null}
              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input type="checkbox" checked={showMidtrans} onChange={(event) => setShowMidtrans(event.target.checked)} />
                Isi Midtrans key sekarang
              </label>
              {showMidtrans ? (
                <>
                  <input value={midtransServerKey} onChange={(event) => setMidtransServerKey(event.target.value)} placeholder="Midtrans Server Key" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
                  <input value={midtransClientKey} onChange={(event) => setMidtransClientKey(event.target.value)} placeholder="Midtrans Client Key" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900" />
                </>
              ) : null}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Kembali</button>
                <button onClick={() => void handleSubmit()} disabled={loading} className="flex-1 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                  {loading ? "Mendaftar..." : "Daftar"}
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
