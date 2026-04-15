-- CreateIndex
CREATE INDEX "Store_userId_idx" ON "Store"("userId");

-- CreateIndex
CREATE INDEX "Product_storeId_idx" ON "Product"("storeId");

-- CreateIndex
CREATE INDEX "Product_storeId_name_idx" ON "Product"("storeId", "name");

-- CreateIndex
CREATE INDEX "TransactionItem_transactionId_idx" ON "TransactionItem"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionItem_productId_idx" ON "TransactionItem"("productId");

-- CreateIndex
CREATE INDEX "Transaction_storeId_createdAt_idx" ON "Transaction"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_shiftId_idx" ON "Transaction"("shiftId");

-- CreateIndex
CREATE INDEX "Transaction_promoId_idx" ON "Transaction"("promoId");

-- CreateIndex
CREATE INDEX "Shift_storeId_status_idx" ON "Shift"("storeId", "status");

-- CreateIndex
CREATE INDEX "Shift_userId_status_idx" ON "Shift"("userId", "status");

-- CreateIndex
CREATE INDEX "Shift_storeId_opened_at_idx" ON "Shift"("storeId", "opened_at");
