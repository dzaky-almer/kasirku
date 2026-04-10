// lib/promo.ts
// Utility untuk kalkulasi diskon promo

export type PromoType = "PRODUCT" | "HAPPY_HOUR" | "MIN_TRANSACTION";
export type DiscountType = "PERCENT" | "NOMINAL";

export interface Promo {
  id: string;
  name: string;
  type: PromoType;
  discountType: DiscountType;
  discountValue: number;
  productId?: string | null;
  startTime?: string | null; // "HH:mm"
  endTime?: string | null;   // "HH:mm"
  minTransaction?: number | null;
}

export interface CartItem {
  productId: string;
  price: number;
  qty: number;
}

/**
 * Cek apakah promo HAPPY_HOUR berlaku sekarang
 */
function isHappyHourActive(startTime: string, endTime: string): boolean {
  const now = new Date();
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Hitung total sebelum diskon
 */
export function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/**
 * Hitung nilai diskon dari promo yang dipilih kasir
 * Returns: { discountAmount, isValid, reason }
 */
export function calculateDiscount(
  promo: Promo,
  items: CartItem[],
  subtotal: number
): { discountAmount: number; isValid: boolean; reason?: string } {
  // Validasi happy hour
  if (promo.type === "HAPPY_HOUR") {
    if (!promo.startTime || !promo.endTime) {
      return { discountAmount: 0, isValid: false, reason: "Konfigurasi happy hour tidak lengkap" };
    }
    if (!isHappyHourActive(promo.startTime, promo.endTime)) {
      return {
        discountAmount: 0,
        isValid: false,
        reason: `Promo hanya berlaku ${promo.startTime}–${promo.endTime}`,
      };
    }
  }

  // Validasi minimum transaksi
  if (promo.type === "MIN_TRANSACTION") {
    if (!promo.minTransaction || subtotal < promo.minTransaction) {
      return {
        discountAmount: 0,
        isValid: false,
        reason: `Minimum transaksi Rp${promo.minTransaction?.toLocaleString("id-ID")}`,
      };
    }
  }

  // Hitung base amount yang kena diskon
  let baseAmount = subtotal;

  if (promo.type === "PRODUCT" && promo.productId) {
    // Diskon hanya berlaku untuk produk tertentu
    const targetItems = items.filter((i) => i.productId === promo.productId);
    if (targetItems.length === 0) {
      return {
        discountAmount: 0,
        isValid: false,
        reason: "Produk yang berhak diskon tidak ada di keranjang",
      };
    }
    baseAmount = targetItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  // Hitung nilai diskon
  let discountAmount = 0;
  if (promo.discountType === "PERCENT") {
    discountAmount = Math.round((baseAmount * promo.discountValue) / 100);
  } else {
    discountAmount = promo.discountValue;
  }

  // Diskon tidak boleh melebihi subtotal
  discountAmount = Math.min(discountAmount, subtotal);

  return { discountAmount, isValid: true };
}