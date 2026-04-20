export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) return "Rp 0";
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function formatRupiahShort(amount: number): string {
  if (!Number.isFinite(amount)) return "Rp 0";
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  if (amount >= 1_000) return `Rp ${Math.round(amount / 1_000)}rb`;
  return formatRupiah(amount);
}
