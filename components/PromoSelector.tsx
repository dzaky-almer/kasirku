// components/PromoSelector.tsx
"use client";

import { useEffect, useState } from "react";
import { calculateDiscount, CartItem, Promo } from "@/lib/promo";

interface PromoSelectorProps {
  storeId: string;
  items: CartItem[];       // item di keranjang saat ini
  subtotal: number;        // total sebelum diskon
  onPromoApplied: (promoId: string | null, discountAmount: number) => void;
}

export default function PromoSelector({
  storeId,
  items,
  subtotal,
  onPromoApplied,
}: PromoSelectorProps) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [selected, setSelected] = useState<Promo | null>(null);
  const [result, setResult] = useState<{ discountAmount: number; isValid: boolean; reason?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch promo aktif
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetch(`/api/promos?storeId=${storeId}`)
      .then((r) => r.json())
      .then((data) => setPromos(data))
      .finally(() => setLoading(false));
  }, [storeId]);

  // Hitung ulang diskon setiap kali item/subtotal/promo berubah
  useEffect(() => {
    if (!selected) {
      setResult(null);
      onPromoApplied(null, 0);
      return;
    }
    const calc = calculateDiscount(selected, items, subtotal);
    setResult(calc);
    onPromoApplied(calc.isValid ? selected.id : null, calc.isValid ? calc.discountAmount : 0);
  }, [selected, items, subtotal]);

  function handleSelect(promo: Promo | null) {
    setSelected(promo);
  }

  if (loading) return <p className="text-sm text-gray-400">Memuat promo...</p>;
  if (promos.length === 0) return <p className="text-sm text-gray-400">Tidak ada promo aktif</p>;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Pilih Promo</p>

      {/* Tombol "Tanpa Promo" */}
      <button
        onClick={() => handleSelect(null)}
        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
          !selected
            ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
            : "border-gray-200 hover:bg-gray-50"
        }`}
      >
        Tanpa promo
      </button>

      {/* List promo */}
      {promos.map((promo) => {
        const isSelected = selected?.id === promo.id;
        // Preview diskon sementara (tanpa validasi waktu, hanya UI)
        const discountLabel =
          promo.discountType === "PERCENT"
            ? `${promo.discountValue}%`
            : `Rp${promo.discountValue.toLocaleString("id-ID")}`;

        return (
          <button
            key={promo.id}
            onClick={() => handleSelect(promo)}
            className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className={`font-medium ${isSelected ? "text-blue-700" : "text-gray-800"}`}>
                  {promo.name}
                </p>
                <p className="text-xs text-gray-500">{promoTypeLabel(promo)}</p>
              </div>
              <span
                className={`text-sm font-semibold ${isSelected ? "text-blue-600" : "text-green-600"}`}
              >
                -{discountLabel}
              </span>
            </div>
          </button>
        );
      })}

      {/* Hasil kalkulasi */}
      {selected && result && (
        <div
          className={`mt-2 px-3 py-2 rounded-lg text-sm ${
            result.isValid
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-600 border border-red-200"
          }`}
        >
          {result.isValid ? (
            <span>
              ✓ Diskon diterapkan:{" "}
              <strong>-Rp{result.discountAmount.toLocaleString("id-ID")}</strong>
            </span>
          ) : (
            <span>✕ {result.reason}</span>
          )}
        </div>
      )}
    </div>
  );
}

function promoTypeLabel(promo: Promo): string {
  if (promo.type === "HAPPY_HOUR") return `Happy hour ${promo.startTime}–${promo.endTime}`;
  if (promo.type === "MIN_TRANSACTION")
    return `Min. transaksi Rp${promo.minTransaction?.toLocaleString("id-ID")}`;
  if (promo.type === "PRODUCT" && promo.productId) return "Diskon produk tertentu";
  return "Semua produk";
}