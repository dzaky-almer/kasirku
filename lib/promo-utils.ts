import { formatRupiah } from "@/lib/currency";

export type PromoRuleType = "PRODUCT" | "HAPPY_HOUR" | "MIN_TRANSACTION";
export type PromoDiscountType = "PERCENT" | "NOMINAL";

export interface PromoRule {
  id: string;
  type: PromoRuleType;
  discountType: PromoDiscountType;
  discountValue: number;
  productId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  minTransaction?: number | null;
}

export interface Promo {
  id: string;
  name: string;
  tag?: string | null;
  isActive?: boolean;
  rules: PromoRule[];
}

export interface PromoCartItem {
  id: string;
  price: number;
  qty: number;
}

export function calculatePromoDiscount(
  promo: Promo,
  cart: PromoCartItem[],
  subtotal: number,
): { amount: number; valid: boolean; reason?: string } {
  if (!promo.rules?.length) {
    return { amount: 0, valid: false, reason: "Tidak ada aturan promo" };
  }

  let totalDiscount = 0;
  let anyValid = false;
  let lastReason: string | undefined;

  for (const rule of promo.rules) {
    if (rule.type === "HAPPY_HOUR") {
      if (!rule.startTime || !rule.endTime) {
        lastReason = "Konfigurasi happy hour tidak lengkap";
        continue;
      }

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMinute] = rule.startTime.split(":").map(Number);
      const [endHour, endMinute] = rule.endTime.split(":").map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        lastReason = `Berlaku ${rule.startTime}-${rule.endTime}`;
        continue;
      }
    }

    if (rule.type === "MIN_TRANSACTION") {
      if (!rule.minTransaction || subtotal < rule.minTransaction) {
        lastReason = `Min. transaksi ${formatRupiah(rule.minTransaction ?? 0)}`;
        continue;
      }
    }

    let baseAmount = subtotal;

    if (rule.type === "PRODUCT" && rule.productId) {
      const targetItems = cart.filter((item) => item.id === rule.productId);
      if (!targetItems.length) {
        lastReason = "Produk promo tidak ada di keranjang";
        continue;
      }

      baseAmount = targetItems.reduce(
        (sum, item) => sum + item.price * item.qty,
        0,
      );
    }

    const amount =
      rule.discountType === "PERCENT"
        ? Math.round((baseAmount * rule.discountValue) / 100)
        : rule.discountValue;

    totalDiscount += amount;
    anyValid = true;
  }

  if (!anyValid) {
    return { amount: 0, valid: false, reason: lastReason };
  }

  return { amount: Math.min(totalDiscount, subtotal), valid: true };
}

export function getPromoTypeLabel(promo: Promo): string {
  if (!promo.rules?.length) return "Semua produk";

  return promo.rules
    .map((rule) => {
      if (rule.type === "HAPPY_HOUR") {
        return `Happy hour ${rule.startTime}-${rule.endTime}`;
      }
      if (rule.type === "MIN_TRANSACTION") {
        return `Min. ${formatRupiah(rule.minTransaction ?? 0)}`;
      }
      if (rule.type === "PRODUCT") {
        return "Diskon produk tertentu";
      }
      return "Semua produk";
    })
    .join(" + ");
}

export function getPromoDiscountLabel(promo: Promo): string {
  if (!promo.rules?.length) return "-";

  return promo.rules
    .map((rule) =>
      rule.discountType === "PERCENT"
        ? `${rule.discountValue}%`
        : formatRupiah(rule.discountValue),
    )
    .join(" + ");
}
