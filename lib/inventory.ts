import { Prisma } from "@prisma/client";

export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT";

interface CreateStockMovementInput {
  storeId: string;
  productId: string;
  type: StockMovementType;
  reason: string;
  qtyChange: number;
  note?: string | null;
  supplierId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdById?: string | null;
}

export async function createStockMovement(
  tx: Prisma.TransactionClient,
  input: CreateStockMovementInput
) {
  const product = await tx.product.findFirst({
    where: {
      id: input.productId,
      storeId: input.storeId,
    },
    select: {
      id: true,
      stock: true,
    },
  });

  if (!product) {
    throw new Error("Produk tidak ditemukan");
  }

  const previousStock = product.stock;
  const newStock = previousStock + input.qtyChange;

  if (newStock < 0) {
    throw new Error("Stok produk tidak cukup");
  }

  await tx.product.update({
    where: { id: product.id },
    data: { stock: newStock },
  });

  return tx.stockMovement.create({
    data: {
      storeId: input.storeId,
      productId: input.productId,
      supplierId: input.supplierId ?? null,
      type: input.type,
      reason: input.reason,
      qtyChange: input.qtyChange,
      previousStock,
      newStock,
      note: input.note?.trim() || null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      createdById: input.createdById ?? null,
    },
  });
}
