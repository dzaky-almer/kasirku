"use client";

import { useEffect, useState } from "react";
import {
  calculatePromoDiscount,
  getPromoDiscountLabel,
  getPromoTypeLabel,
  Promo,
  PromoCartItem,
} from "@/lib/promo-utils";
import { formatRupiah } from "@/lib/currency";

interface PromoSelectorProps {
  storeId: string;
  items: PromoCartItem[];
  subtotal: number;
  onPromoApplied: (promoId: string | null, discountAmount: number) => void;
}

export default function PromoSelector({
  storeId,
  items,
  subtotal,
  onPromoApplied,
}: PromoSelectorProps) {
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [selected, setSelected] = useState<Promo | null>(null);

  useEffect(() => {
    if (!storeId) return;

    let cancelled = false;

    fetch(`/api/promos?storeId=${storeId}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setPromos(Array.isArray(data) ? data : []);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const result = selected
    ? calculatePromoDiscount(selected, items, subtotal)
    : null;

  useEffect(() => {
    if (!selected) {
      onPromoApplied(null, 0);
      return;
    }

    onPromoApplied(
      result?.valid ? selected.id : null,
      result?.valid ? result.amount : 0,
    );
  }, [selected, result, onPromoApplied]);

  if (promos === null) {
    return <p className="text-sm text-gray-400">Memuat promo...</p>;
  }

  if (promos.length === 0) {
    return <p className="text-sm text-gray-400">Tidak ada promo aktif</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Pilih Promo</p>

      <button
        onClick={() => setSelected(null)}
        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
          !selected
            ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
            : "border-gray-200 hover:bg-gray-50"
        }`}
      >
        Tanpa promo
      </button>

      {promos.map((promo) => {
        const preview = calculatePromoDiscount(promo, items, subtotal);
        const isSelected = selected?.id === promo.id;

        return (
          <button
            key={promo.id}
            onClick={() => setSelected(promo)}
            className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <p
                  className={`font-medium ${
                    isSelected ? "text-blue-700" : "text-gray-800"
                  }`}
                >
                  {promo.name}
                </p>
                <p className="text-xs text-gray-500">{getPromoTypeLabel(promo)}</p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  preview.valid ? "text-green-600" : "text-gray-400"
                }`}
              >
                -{getPromoDiscountLabel(promo)}
              </span>
            </div>
          </button>
        );
      })}

      {selected && result && (
        <div
          className={`mt-2 px-3 py-2 rounded-lg text-sm ${
            result.valid
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-600 border border-red-200"
          }`}
        >
          {result.valid ? (
            <span>
              Diskon diterapkan: <strong>-{formatRupiah(result.amount)}</strong>
            </span>
          ) : (
            <span>{result.reason}</span>
          )}
        </div>
      )}
    </div>
  );
}
