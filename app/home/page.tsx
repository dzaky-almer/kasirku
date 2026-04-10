'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, Zap, Store, BarChart3, Scissors, Smartphone, ArrowRight,
  Menu, X, ShieldCheck, ChevronDown, Download, Calendar, BrainCircuit,
  Lock, Play, RotateCcw, Sparkles, User, Clock, CreditCard, Star,
  TrendingUp, Package, Receipt, Wifi, AlertCircle, ChevronRight, Coffee
} from 'lucide-react';

// ============================================================
// WHATSAPP ICON
// ============================================================
const WhatsAppIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);


const CONFIG = {
  // TODO: Ganti nomor WA admin tanpa awalan 0 (pakai kode negara 62)
  waAdminNumber: "6289673981065",

  // TODO: Ganti ke URL production saat deploy
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

// ============================================================
// PRICING DATA
// ============================================================
const PLANS = [
  {
    key: "Starter",
    label: "Starter",
    tagline: "Untuk UMKM baru mulai",
    icon: <Store size={22} />,
    colorClass: "border-slate-200",
    accentClass: "text-slate-700",
    btnClass: "border-2 border-slate-200 text-slate-600 hover:bg-slate-50",
    checkClass: "text-emerald-500",
    yearly: "499.000",
    monthly: "59.000",
    features: [
      "Kasir digital unlimited transaksi",
      "Manajemen produk & stok",
      "2 akun (Admin + Kasir)",
      "Laporan penjualan harian",
      "Struk digital via WhatsApp",
      "Dashboard monitoring",
    ],
    notIncluded: ["Sistem booking antrean", "Ekspor Excel/PDF", "AI Insight"],
  },
  {
    key: "Pro",
    label: "Pro",
    tagline: "Barbershop & Cafe pilihan",
    icon: <Scissors size={22} />,
    colorClass: "border-amber-600 border-2",
    accentClass: "text-amber-700",
    btnClass: "bg-amber-700 text-white hover:bg-amber-800 shadow-lg shadow-amber-700/30",
    checkClass: "text-amber-600",
    yearly: "799.000",
    monthly: "89.000",
    badge: "Paling Populer",
    features: [
      "Semua fitur Starter",
      "Sistem booking & antrean",
      "Ekspor data PDF & Excel",
      "Pembayaran QRIS terintegrasi",
      "Custom struk & nama toko",
      "5 akun staff",
      "Laporan laba-rugi otomatis",
    ],
    notIncluded: ["AI Insight analitik", "Multi-cabang"],
  },
  {
    key: "Ultra",
    label: "Ultra",
    tagline: "Bisnis multi-cabang skala besar",
    icon: <BrainCircuit size={22} />,
    colorClass: "border-slate-700",
    accentClass: "text-amber-400",
    btnClass: "bg-white text-slate-900 hover:bg-slate-100",
    checkClass: "text-amber-400",
    yearly: "1.490.000",
    monthly: "169.000",
    dark: true,
    features: [
      "Semua fitur Pro",
      "AI Insight analitik produk",
      "Manajemen multi-cabang",
      "Unlimited akun staff",
      "Dashboard grafik advanced",
      "Prioritas support",
      "Custom integrasi API",
    ],
    notIncluded: [],
  },
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isYearly, setIsYearly] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState(0); // untuk how-it-works tabs
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ---- NAVIGATION ----
  const goTo = (path: string) => { window.location.href = path; };

  // ---- WA CHECKOUT ----
  // Pesan otomatis terbentuk berdasarkan paket yang diklik
  const handleWA = (planLabel: string) => {
    const tipe = isYearly ? "Tahunan" : "Bulanan";
    // TODO: Sesuaikan isi pesan jika diperlukan
    const msg = `Halo Admin TokoKu! 👋\n\nSaya tertarik berlangganan:\n\n*Paket: ${planLabel} (${tipe})*\n\nBoleh tahu langkah selanjutnya untuk proses pembayaran? Terima kasih!`;
    window.open(`https://wa.me/${CONFIG.waAdminNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ---- WA GENERAL ----
  const handleWAGeneral = () => {
    const msg = `Halo Admin TokoKu! Saya mau tanya-tanya tentang aplikasinya dulu 😊`;
    window.open(`https://wa.me/${CONFIG.waAdminNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!mounted) return null;

  // ============================================================
  // HOW IT WORKS STEPS
  // ============================================================
  const howItWorks = [
    {
      id: 0,
      tab: "Coba Demo",
      emoji: "🎮",
      title: "Coba Gratis Tanpa Daftar",
      desc: "Klik tombol Akun Demo di halaman utama. Langsung masuk ke sistem kasir TokoKu dengan data demo siap pakai — tanpa perlu email, tanpa password.",
      note: "⏱ Sesi demo berlangsung 1 jam. Jika habis, ada pilihan lanjut berlangganan atau reset akun.",
      steps: ["Klik 'Coba Akun Demo'", "Sistem kasir langsung terbuka", "Coba semua fitur sepuasnya", "Putuskan untuk berlangganan"],
      color: "bg-amber-50 border-amber-200",
      iconBg: "bg-amber-700",
    },
    {
      id: 1,
      tab: "Berlangganan",
      emoji: "💳",
      title: "Berlangganan via WhatsApp",
      desc: "Pilih paket yang cocok, klik tombol berlangganan. WhatsApp akan terbuka otomatis dengan pesan yang sudah terisi — tinggal kirim dan tunggu konfirmasi admin.",
      note: "✅ Admin memproses pembayaran dan mengaktifkan akun kamu dalam 1×24 jam.",
      steps: ["Pilih paket (Starter/Pro/Ultra)", "Klik tombol WA — pesan otomatis terisi", "Kirim & tunggu admin respon", "Bayar → akun aktif!"],
      color: "bg-green-50 border-green-200",
      iconBg: "bg-green-600",
    },
    {
      id: 2,
      tab: "Buat Akun",
      emoji: "🏪",
      title: "Daftar & Setup Toko",
      desc: "Setelah berlangganan aktif, kamu akan diminta membuat akun. Isi nama toko, jenis usaha, nomor WhatsApp, dan kunci Midtrans (untuk terima pembayaran QRIS).",
      note: "🔑 Kunci Midtrans didapat dari dashboard Midtrans kamu. Lihat panduan di bawah.",
      steps: ["Isi nama toko & jenis usaha", "Masukkan nomor WhatsApp toko", "Input Midtrans Server Key & Client Key", "Selesai — sistem siap digunakan!"],
      color: "bg-blue-50 border-blue-200",
      iconBg: "bg-blue-600",
    },
    {
      id: 3,
      tab: "Setup Midtrans",
      emoji: "⚙️",
      title: "Cara Dapat Kunci Midtrans",
      desc: "Midtrans adalah payment gateway untuk terima pembayaran QRIS dari pelanggan. Daftar gratis, verifikasi identitas, lalu ambil kunci API-nya.",
      note: "⚡ Verifikasi Midtrans bisa memakan waktu hingga 3 hari kerja.",
      steps: ["Daftar di midtrans.com", "Verifikasi KTP & rekening bank", "Tunggu verifikasi (maks. 3 hari)", "Buka Settings → Access Keys → copy Server Key & Client Key"],
      color: "bg-purple-50 border-purple-200",
      iconBg: "bg-purple-700",
    },
  ];

  // ============================================================
  // FAQ DATA
  // ============================================================
  const faqs = [
    { q: "Apakah Akun Demo benar-benar gratis?", a: "Ya, 100% gratis dan langsung bisa dipakai tanpa daftar. Akun demo di-reset otomatis setiap 1 jam, jadi data yang kamu input tidak tersimpan permanen." },
    { q: "Bagaimana cara berlangganan?", a: "Pilih paket yang cocok, klik tombol 'Berlangganan via WA'. WhatsApp akan terbuka dengan pesan otomatis. Kirim ke admin, lakukan pembayaran, dan akun langsung diaktifkan." },
    { q: "Apakah data toko saya aman?", a: "Sangat aman. Data disimpan di Supabase dengan enkripsi standar industri. Setiap toko terisolasi — tidak ada yang bisa melihat data toko lain." },
    { q: "Apa itu Midtrans dan apakah wajib?", a: "Midtrans adalah payment gateway untuk menerima pembayaran QRIS dari pelanggan. Jika kamu tidak butuh QRIS, bisa tetap pakai fitur kasir dengan pembayaran cash. Midtrans hanya diperlukan untuk paket Pro ke atas." },
    { q: "Bisakah upgrade paket nanti?", a: "Tentu! Kamu bisa upgrade kapan saja. Hubungi admin via WA, dan sisa masa berlangganan akan dihitung secara prorata." },
    { q: "Berapa banyak staff yang bisa ditambahkan?", a: "Starter: 2 akun (Admin+Kasir). Pro: 5 akun staff. Ultra: Unlimited akun staff dengan multi-cabang." },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="bg-white min-h-screen font-sans text-slate-900 overflow-x-hidden">

      {/* ===== NAVBAR ===== */}
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-slate-100 py-3' : 'bg-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 group">
            <div className="bg-amber-700 text-white p-1.5 rounded-xl shadow-lg group-hover:rotate-6 transition-transform">
              <Zap size={18} fill="currentColor" />
            </div>
            <span className="text-xl font-black tracking-tight">
              <span className="text-amber-700">Toko</span><span className="text-slate-900">Ku</span>
            </span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-500">
            <a href="#cara-kerja" className="hover:text-amber-700 transition-colors">Cara Kerja</a>
            <a href="#fitur" className="hover:text-amber-700 transition-colors">Fitur</a>
            <a href="#harga" className="hover:text-amber-700 transition-colors">Harga</a>
            <a href="#faq" className="hover:text-amber-700 transition-colors">FAQ</a>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <button onClick={() => goTo('/login')}
              className="flex items-center gap-2 text-slate-500 hover:text-amber-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-50 transition">
              <User size={15} /> Masuk
            </button>
            <button onClick={() => goTo('/dashboard')}
              className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition">
              <Play size={13} fill="currentColor" /> Coba Demo
            </button>
            <button onClick={() => goTo('/register')}
              className="flex items-center gap-2 bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-black hover:bg-amber-800 transition shadow-lg shadow-amber-700/20">
              Daftar Sekarang <ChevronRight size={14} />
            </button>
          </div>

          {/* Mobile Hamburger */}
          <button className="lg:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* ===== MOBILE MENU ===== */}
      <div className={`lg:hidden fixed inset-0 z-[200] bg-white flex flex-col transition-all duration-500 ${
        isMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'
      }`}>
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
          <span className="text-xl font-black"><span className="text-amber-700">Toko</span>Ku</span>
          <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-100 rounded-xl"><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-4 p-6 flex-grow">
          {['#cara-kerja', '#fitur', '#harga', '#faq'].map((href, i) => (
            <a key={i} href={href} onClick={() => setIsMenuOpen(false)}
              className="text-2xl font-black text-slate-700 py-3 border-b border-slate-50 capitalize">
              {href.replace('#', '').replace('-', ' ')}
            </a>
          ))}
        </div>
        <div className="p-6 space-y-3">
          <button onClick={() => goTo('/login')} className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2">
            <User size={18} /> Masuk Dashboard
          </button>
          <button onClick={() => goTo('/dashboard')} className="w-full py-4 bg-amber-100 text-amber-800 rounded-2xl font-bold flex items-center justify-center gap-2">
            <Play size={16} fill="currentColor" /> Coba Akun Demo
          </button>
          <button onClick={() => goTo('/register')} className="w-full py-4 bg-amber-700 text-white rounded-2xl font-black shadow-xl">
            Daftar Sekarang
          </button>
        </div>
      </div>

      {/* ===== HERO ===== */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-20 pb-16 px-6 overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-amber-50 via-white to-orange-50/30" />
          <div className="absolute top-1/4 -right-32 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-72 h-72 bg-orange-100/60 rounded-full blur-3xl" />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center gap-16">
          {/* Text */}
          <div className="flex-1 space-y-8 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white border border-amber-200 text-amber-800 px-4 py-2 rounded-full text-xs font-bold shadow-sm">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Sistem POS #1 untuk Barbershop & Cafe
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight">
              Kasir Digital
              <br />
              <span className="relative inline-block">
                <span className="text-amber-700">Tanpa Ribet.</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 4 150 2 298 8" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="text-lg text-slate-500 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Kelola transaksi, stok, laporan, dan booking dalam satu sistem.
              <strong className="text-slate-700"> Coba langsung tanpa daftar</strong> — kami yakin kamu akan suka.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button onClick={() => goTo('/dashboard')}
                className="group flex items-center justify-center gap-3 bg-amber-700 text-white px-8 py-4 rounded-2xl font-black text-base hover:bg-amber-800 transition-all hover:-translate-y-1 shadow-2xl shadow-amber-700/30 active:scale-95">
                <Play size={18} fill="currentColor" />
                Coba Akun Demo Gratis
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => document.getElementById('harga')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-bold text-base hover:border-amber-300 hover:bg-amber-50 transition-all shadow-sm">
                Lihat Paket Harga
              </button>
            </div>

            {/* Demo notice */}
            <div className="flex items-center justify-center lg:justify-start gap-3 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 w-fit mx-auto lg:mx-0 px-5 py-3 rounded-2xl">
              <RotateCcw size={13} className="animate-spin" style={{ animationDuration: '4s' }} />
              Akun demo di-reset otomatis setiap 1 jam • Tidak perlu daftar
            </div>

            {/* Social proof */}
            <div className="flex items-center justify-center lg:justify-start gap-6 pt-2">
              <div className="flex -space-x-2">
                {['🧑‍💼', '👩‍🍳', '💈', '☕'].map((e, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-xs">{e}</div>
                ))}
              </div>
              <p className="text-xs text-slate-500"><strong className="text-slate-700">200+ toko</strong> sudah pakai TokoKu</p>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="#f59e0b" className="text-amber-500" />)}
              </div>
            </div>
          </div>

          {/* Phone Mockup */}
          <div className="flex-shrink-0 hidden lg:block relative">
            {/* Outer glow */}
            <div className="absolute inset-0 bg-amber-400/20 rounded-[4rem] blur-2xl scale-110" />
            {/* Phone frame */}
            <div className="relative w-72 bg-slate-900 rounded-[3rem] p-2.5 shadow-[0_40px_80px_-10px_rgba(0,0,0,0.4)] border-[10px] border-slate-800 rotate-3 hover:rotate-0 transition-transform duration-700">
              <div className="bg-white rounded-[2.5rem] overflow-hidden h-[560px] flex flex-col">
                {/* Status bar */}
                <div className="bg-amber-700 px-6 pt-3 pb-4">
                  <div className="flex justify-between items-center text-white/60 text-[9px] mb-3">
                    <span>9:41</span>
                    <div className="flex gap-1">
                      <Wifi size={10} /><span>TokoKu</span>
                    </div>
                  </div>
                  <div className="text-white">
                    <p className="text-[10px] font-bold opacity-70 uppercase tracking-wider">Omzet Hari Ini</p>
                    <p className="text-3xl font-black tracking-tight">Rp 2.450.000</p>
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp size={10} className="text-green-300" />
                      <p className="text-[10px] text-green-300 font-bold">+18% dari kemarin</p>
                    </div>
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 p-4 space-y-3 overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Transaksi Terbaru</p>
                  {[
                    { item: 'Kopi Susu', time: '14:32', total: 'Rp 28.000', color: 'bg-amber-50' },
                    { item: 'Potong + Cuci', time: '14:15', total: 'Rp 55.000', color: 'bg-blue-50' },
                    { item: 'Nasi Ayam', time: '13:58', total: 'Rp 35.000', color: 'bg-green-50' },
                  ].map((t, i) => (
                    <div key={i} className={`${t.color} rounded-2xl p-3 flex justify-between items-center`}>
                      <div>
                        <p className="text-[11px] font-black text-slate-700">{t.item}</p>
                        <p className="text-[9px] text-slate-400">{t.time}</p>
                      </div>
                      <p className="text-[11px] font-black text-slate-800">{t.total}</p>
                    </div>
                  ))}
                  {/* QRIS badge */}
                  <div className="bg-emerald-500 rounded-2xl p-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                    <p className="text-[10px] font-black text-white uppercase tracking-wide">QRIS Terhubung · Sistem Online</p>
                  </div>
                </div>
                {/* Bottom nav */}
                <div className="h-12 border-t border-slate-100 flex justify-around items-center px-4">
                  {[Receipt, Package, BarChart3, User].map((Icon, i) => (
                    <div key={i} className={`p-2 rounded-xl ${i === 0 ? 'bg-amber-700 text-white' : 'text-slate-300'}`}>
                      <Icon size={14} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <div className="bg-slate-900 py-10 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { val: "200+", label: "Toko Aktif" },
            { val: "50rb+", label: "Transaksi/Bulan" },
            { val: "99.9%", label: "Uptime Server" },
            { val: "< 1 jam", label: "Setup Awal" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-black text-amber-400">{s.val}</div>
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== CARA KERJA ===== */}
      <section id="cara-kerja" className="py-24 px-6 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">Cara Kerja</span>
            <h2 className="text-4xl font-black tracking-tight">Mulai dalam 4 langkah mudah</h2>
            <p className="text-slate-500 max-w-lg mx-auto">Dari coba demo sampai sistem toko kamu jalan penuh — semua bisa dalam sehari.</p>
          </div>

          {/* Tab Selector */}
          <div className="flex overflow-x-auto gap-2 pb-2 mb-8 justify-center">
            {howItWorks.map((step) => (
              <button key={step.id} onClick={() => setActiveStep(step.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all ${
                  activeStep === step.id
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                <span>{step.emoji}</span> {step.tab}
              </button>
            ))}
          </div>

          {/* Active Step Content */}
          {howItWorks.map((step) => step.id === activeStep && (
            <div key={step.id} className={`rounded-3xl border p-8 md:p-12 ${step.color}`}>
              <div className="flex flex-col md:flex-row gap-10">
                <div className="flex-1 space-y-6">
                  <div className={`w-14 h-14 ${step.iconBg} text-white rounded-2xl flex items-center justify-center text-2xl`}>
                    {step.emoji}
                  </div>
                  <h3 className="text-2xl font-black">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{step.desc}</p>
                  <div className="bg-white/70 border border-white rounded-2xl px-4 py-3 text-sm font-medium text-slate-700">
                    {step.note}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Langkah-langkah:</p>
                  <div className="space-y-3">
                    {step.steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-4 bg-white/60 rounded-2xl px-5 py-4 border border-white">
                        <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </div>
                        <span className="font-semibold text-slate-700">{s}</span>
                      </div>
                    ))}
                  </div>
                  {/* CTA per step */}
                  {step.id === 0 && (
                    <button onClick={() => goTo('/dashboard')}
                      className="mt-6 w-full bg-amber-700 text-white py-4 rounded-2xl font-black hover:bg-amber-800 transition flex items-center justify-center gap-2">
                      <Play size={16} fill="currentColor" /> Mulai Demo Sekarang
                    </button>
                  )}
                  {step.id === 1 && (
                    <button onClick={() => document.getElementById('harga')?.scrollIntoView({ behavior: 'smooth' })}
                      className="mt-6 w-full bg-green-600 text-white py-4 rounded-2xl font-black hover:bg-green-700 transition flex items-center justify-center gap-2">
                      Lihat Paket & Harga <ArrowRight size={16} />
                    </button>
                  )}
                  {step.id === 2 && (
                    <button onClick={() => goTo('/register')}
                      className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition flex items-center justify-center gap-2">
                      Daftar Akun Toko <ArrowRight size={16} />
                    </button>
                  )}
                  {step.id === 3 && (
                    <a href="https://midtrans.com" target="_blank" rel="noopener noreferrer"
                      className="mt-6 w-full bg-purple-700 text-white py-4 rounded-2xl font-black hover:bg-purple-800 transition flex items-center justify-center gap-2">
                      Daftar Midtrans <ArrowRight size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FITUR UTAMA ===== */}
      <section id="fitur" className="py-24 px-6 bg-slate-50 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">Fitur Lengkap</span>
            <h2 className="text-4xl font-black tracking-tight">Semua yang kamu butuhkan,<br />ada di TokoKu</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Receipt size={24} />,
                title: "Kasir Super Cepat",
                desc: "Input transaksi dengan barcode scanner, hitung kembalian otomatis, cetak atau kirim struk via WhatsApp.",
                tag: "Semua Paket",
                tagColor: "bg-emerald-50 text-emerald-700",
              },
              {
                icon: <Package size={24} />,
                title: "Manajemen Stok Real-time",
                desc: "Pantau stok semua produk seketika. Notifikasi otomatis saat stok hampir habis sesuai batas yang kamu set.",
                tag: "Semua Paket",
                tagColor: "bg-emerald-50 text-emerald-700",
              },
              {
                icon: <BarChart3 size={24} />,
                title: "Laporan Otomatis",
                desc: "Rekap harian, mingguan, bulanan. Laporan laba-rugi langsung tersaji tanpa perlu hitung manual.",
                tag: "Semua Paket",
                tagColor: "bg-emerald-50 text-emerald-700",
              },
              {
                icon: <WhatsAppIcon size={24} />,
                title: "Struk Digital via WA",
                desc: "Setiap transaksi lunas, struk dikirim otomatis ke WhatsApp pelanggan. Profesional dan paperless.",
                tag: "Semua Paket",
                tagColor: "bg-emerald-50 text-emerald-700",
              },
              {
                icon: <Calendar size={24} />,
                title: "Booking & Antrean",
                desc: "Sistem antrean digital untuk barbershop dan salon. Pelanggan bisa booking slot dari luar toko.",
                tag: "Pro & Ultra",
                tagColor: "bg-amber-50 text-amber-700",
              },
              {
                icon: <CreditCard size={24} />,
                title: "Pembayaran QRIS",
                desc: "Terima pembayaran QRIS dari semua dompet digital (GoPay, OVO, Dana, dll) via integrasi Midtrans.",
                tag: "Pro & Ultra",
                tagColor: "bg-amber-50 text-amber-700",
              },
              {
                icon: <Download size={24} />,
                title: "Ekspor PDF & Excel",
                desc: "Unduh laporan bulanan dalam format PDF atau Excel satu klik untuk kebutuhan pembukuan.",
                tag: "Pro & Ultra",
                tagColor: "bg-amber-50 text-amber-700",
              },
              {
                icon: <BrainCircuit size={24} />,
                title: "AI Insight Analitik",
                desc: "Rekomendasi produk terlaris, tren penjualan, dan saran restocking berbasis kecerdasan buatan.",
                tag: "Ultra",
                tagColor: "bg-purple-50 text-purple-700",
              },
              {
                icon: <Store size={24} />,
                title: "Multi-Cabang",
                desc: "Kelola banyak cabang toko dari satu dashboard owner. Perbandingan performa antar cabang real-time.",
                tag: "Ultra",
                tagColor: "bg-purple-50 text-purple-700",
              },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-8 hover:shadow-lg hover:border-amber-200 transition-all group cursor-default">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center group-hover:bg-amber-700 group-hover:text-white transition-all">
                    {f.icon}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${f.tagColor}`}>{f.tag}</span>
                </div>
                <h4 className="text-base font-black mb-2 text-slate-800">{f.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ROLE SYSTEM ===== */}
      <section className="py-24 px-6 bg-slate-900 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} />
        </div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-4 py-2 rounded-full border border-amber-400/20">Keamanan Data</span>
            <h2 className="text-4xl font-black text-white">Sistem dua peran,<br />data aman terpisah</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Kasirku memisahkan hak akses sehingga kasir tidak bisa mengubah harga atau melihat laporan owner.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/8 transition-colors">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <Smartphone size={24} />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Role Kasir</h3>
              <p className="text-slate-400 text-sm mb-5">Akses terbatas hanya untuk operasional harian.</p>
              <ul className="space-y-3">
                {['Input transaksi baru', 'Cek stok produk', 'Buka & tutup shift', 'Kirim struk WA'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                    <CheckCircle size={15} className="text-amber-400 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-amber-700/10 border border-amber-700/30 rounded-3xl p-8 hover:bg-amber-700/15 transition-colors">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Role Admin / Owner</h3>
              <p className="text-slate-400 text-sm mb-5">Akses penuh untuk monitoring dan manajemen bisnis.</p>
              <ul className="space-y-3">
                {['Semua akses kasir', 'Laporan & grafik lengkap', 'Kelola produk & harga', 'Manajemen akun staff', 'Ekspor data & laporan', 'Pengaturan toko'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                    <CheckCircle size={15} className="text-amber-400 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Lock mode info */}
          <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex gap-4 items-start">
            <Lock size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-bold text-sm">Auto Lock Mode</p>
              <p className="text-slate-400 text-sm mt-1">Jika langganan berakhir, sistem kasir otomatis terkunci. Data tetap aman, hanya input baru yang diblokir. Perpanjang berlangganan untuk unlock.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="harga" className="py-24 px-6 scroll-mt-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">Harga</span>
            <h2 className="text-4xl font-black tracking-tight">Pilih paket yang pas untuk bisnis kamu</h2>
            <p className="text-slate-500">Semua paket termasuk uji coba demo gratis. Bayar tahunan hemat 2 bulan.</p>

            {/* Toggle */}
            <div className="pt-4 flex justify-center">
              <div className="inline-flex bg-slate-100 p-1 rounded-2xl gap-1">
                <button onClick={() => setIsYearly(false)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${!isYearly ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}>
                  Bulanan
                </button>
                <button onClick={() => setIsYearly(true)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${isYearly ? 'bg-amber-700 text-white shadow-md' : 'text-slate-500'}`}>
                  Tahunan
                  {isYearly && <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full font-black">Hemat 2 bln!</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {PLANS.map((plan) => (
              <div key={plan.key}
                className={`rounded-3xl border p-8 flex flex-col transition-all ${plan.dark ? 'bg-slate-900 text-white' : 'bg-white'} ${plan.colorClass} ${plan.badge ? 'shadow-2xl shadow-amber-700/20 md:-mt-4 md:mb-4' : 'shadow-sm'}`}>
                {plan.badge && (
                  <div className="mb-4">
                    <span className="bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                      ⭐ {plan.badge}
                    </span>
                  </div>
                )}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${plan.dark ? 'bg-white/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                  {plan.icon}
                </div>
                <h3 className={`text-xl font-black mb-1 ${plan.accentClass}`}>{plan.label}</h3>
                <p className={`text-xs font-bold mb-6 ${plan.dark ? 'text-slate-400' : 'text-slate-400'}`}>{plan.tagline}</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xs font-bold ${plan.dark ? 'text-amber-400' : 'text-amber-700'}`}>Rp</span>
                    <span className={`text-4xl font-black tracking-tight ${plan.dark ? 'text-white' : 'text-slate-900'}`}>
                      {isYearly ? plan.yearly : plan.monthly}
                    </span>
                    <span className={`text-xs font-bold ${plan.dark ? 'text-slate-500' : 'text-slate-400'}`}>
                      /{isYearly ? 'tahun' : 'bulan'}
                    </span>
                  </div>
                  {isYearly && (
                    <p className="text-xs text-emerald-600 font-bold mt-1">
                      ✓ Hemat 2 bulan dibanding bayar bulanan
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-3 text-sm font-medium ${plan.dark ? 'text-slate-300' : 'text-slate-600'}`}>
                      <CheckCircle size={15} className={`${plan.checkClass} shrink-0 mt-0.5`} /> {f}
                    </li>
                  ))}
                  {plan.notIncluded.map((f, i) => (
                    <li key={i} className={`flex items-start gap-3 text-sm font-medium ${plan.dark ? 'text-slate-600' : 'text-slate-300'}`}>
                      <X size={15} className="shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button onClick={() => handleWA(plan.label)}
                  className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${plan.btnClass}`}>
                  <WhatsAppIcon size={16} />
                  Berlangganan via WA
                </button>
                <p className={`text-center text-[10px] mt-3 ${plan.dark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Pesan WA otomatis terbentuk · Admin respon cepat
                </p>
              </div>
            ))}
          </div>

          {/* Demo CTA below pricing */}
          <div className="mt-12 bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center">
            <p className="text-sm text-amber-700 font-bold mb-2">Belum yakin mau pilih paket mana?</p>
            <h3 className="text-xl font-black text-slate-900 mb-4">Coba dulu gratis — tanpa kartu kredit, tanpa daftar</h3>
            <button onClick={() => goTo('/dashboard')}
              className="inline-flex items-center gap-2 bg-amber-700 text-white px-8 py-4 rounded-2xl font-black hover:bg-amber-800 transition shadow-lg shadow-amber-700/20">
              <Play size={16} fill="currentColor" /> Masuk Akun Demo
            </button>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-24 px-6 bg-slate-50 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">FAQ</span>
            <h2 className="text-4xl font-black tracking-tight">Pertanyaan yang sering ditanya</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-all">
                <button onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full px-7 py-6 text-left flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-800">{faq.q}</span>
                  <ChevronDown size={18} className={`text-amber-600 shrink-0 transition-transform duration-300 ${activeFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${activeFaq === i ? 'max-h-40' : 'max-h-0'}`}>
                  <div className="px-7 pb-6 text-slate-500 text-sm leading-relaxed border-t border-slate-50 pt-4">
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm mb-4">Pertanyaan lain? Hubungi admin langsung.</p>
            <button onClick={handleWAGeneral}
              className="inline-flex items-center gap-2 bg-[#25D366] text-white px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition">
              <WhatsAppIcon size={18} /> Chat Admin via WhatsApp
            </button>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-24 px-6 bg-slate-900 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500 rounded-full blur-3xl" />
        </div>
        <div className="max-w-2xl mx-auto relative z-10 space-y-6">
          <div className="text-5xl">🚀</div>
          <h2 className="text-4xl font-black">Mulai sekarang, gratis</h2>
          <p className="text-slate-400 text-lg">Coba semua fitur TokoKu tanpa daftar. Kalau cocok, baru berlangganan.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button onClick={() => goTo('/dashboard')}
              className="flex items-center justify-center gap-2 bg-amber-700 text-white px-10 py-4 rounded-2xl font-black text-lg hover:bg-amber-800 transition shadow-2xl shadow-amber-700/40">
              <Play size={20} fill="currentColor" /> Coba Akun Demo
            </button>
            <button onClick={() => goTo('/register')}
              className="flex items-center justify-center gap-2 bg-white text-slate-900 px-10 py-4 rounded-2xl font-black text-lg hover:bg-slate-50 transition">
              Daftar & Mulai Sekarang <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-slate-950 py-16 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-12">
            <div className="space-y-3">
              <div className="text-2xl font-black">
                <span className="text-amber-500">Toko</span><span className="text-white">Ku</span>
              </div>
              <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                Sistem POS digital untuk barbershop, cafe, warung, dan UMKM Indonesia.
              </p>
              <button onClick={handleWAGeneral}
                className="flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">
                <WhatsAppIcon size={16} /> Hubungi Admin
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="text-white font-black mb-3 text-xs uppercase tracking-wider">Produk</p>
                <div className="space-y-2 text-slate-500">
                  <a href="#fitur" className="block hover:text-amber-400 transition">Fitur</a>
                  <a href="#harga" className="block hover:text-amber-400 transition">Harga</a>
                  <a href="#cara-kerja" className="block hover:text-amber-400 transition">Cara Kerja</a>
                </div>
              </div>
              <div>
                <p className="text-white font-black mb-3 text-xs uppercase tracking-wider">Akun</p>
                <div className="space-y-2 text-slate-500">
                  <button onClick={() => goTo('/login')} className="block hover:text-amber-400 transition">Masuk</button>
                  <button onClick={() => goTo('/register')} className="block hover:text-amber-400 transition">Daftar</button>
                  <button onClick={() => goTo('/dashboard')} className="block hover:text-amber-400 transition">Demo</button>
                </div>
              </div>
              <div>
                <p className="text-white font-black mb-3 text-xs uppercase tracking-wider">Dukungan</p>
                <div className="space-y-2 text-slate-500">
                  <a href="#faq" className="block hover:text-amber-400 transition">FAQ</a>
                  <button onClick={handleWAGeneral} className="block hover:text-amber-400 transition">WhatsApp</button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-600">
            <p>© 2026 TokoKu. Hak cipta dilindungi.</p>
            <p className="text-amber-600 font-bold">Dibuat oleh Muhammad Fachri Hibrizi & Tim SMKN 1 Bekasi 🇮🇩</p>
          </div>
        </div>
      </footer>

      {/* ===== FLOATING WA BUTTON ===== */}
      <button onClick={handleWAGeneral}
        className="fixed bottom-6 right-6 z-[90] bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform group">
        <WhatsAppIcon size={28} />
        <span className="absolute bottom-full right-0 mb-2 bg-white text-slate-800 text-xs font-bold px-4 py-2 rounded-xl shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Tanya Admin TokoKu 👋
        </span>
      </button>
    </div>
  );
}