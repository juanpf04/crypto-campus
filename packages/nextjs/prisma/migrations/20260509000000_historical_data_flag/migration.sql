-- Datos históricos solo-Prisma (TFG): permite sembrar registros antiguos
-- (3-12 meses atrás) sin contraparte on-chain para que las gráficas tengan
-- datos en demos recién instaladas. Los registros con `historical = true` no
-- son accionables: las server actions filtran con ONLY_LIVE y los guards
-- ensureOnChainId rechazan cualquier writeContract sobre ellos.

-- ── Loan ───────────────────────────────────────────────────────────────────
ALTER TABLE "Loan" ALTER COLUMN "loanId" DROP NOT NULL;
ALTER TABLE "Loan" ADD COLUMN "historical" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX "Loan_userId_historical_idx" ON "Loan" ("userId", "historical");
CREATE INDEX "Loan_status_historical_idx" ON "Loan" ("status", "historical");

-- ── RoomBooking ────────────────────────────────────────────────────────────
ALTER TABLE "RoomBooking" ALTER COLUMN "bookingId" DROP NOT NULL;
ALTER TABLE "RoomBooking" ALTER COLUMN "txHash" DROP NOT NULL;
ALTER TABLE "RoomBooking" ADD COLUMN "historical" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX "RoomBooking_userId_historical_idx" ON "RoomBooking" ("userId", "historical");
CREATE INDEX "RoomBooking_date_cancelled_historical_idx" ON "RoomBooking" ("date", "cancelled", "historical");

-- ── PrintLog ───────────────────────────────────────────────────────────────
ALTER TABLE "PrintLog" ALTER COLUMN "txHash" DROP NOT NULL;
ALTER TABLE "PrintLog" ADD COLUMN "historical" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX "PrintLog_userId_historical_idx" ON "PrintLog" ("userId", "historical");
CREATE INDEX "PrintLog_createdAt_historical_idx" ON "PrintLog" ("createdAt", "historical");

-- ── OrderBatch ─────────────────────────────────────────────────────────────
ALTER TABLE "OrderBatch" ALTER COLUMN "batchId" DROP NOT NULL;
ALTER TABLE "OrderBatch" ALTER COLUMN "txHash" DROP NOT NULL;
ALTER TABLE "OrderBatch" ADD COLUMN "historical" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX "OrderBatch_userId_historical_idx" ON "OrderBatch" ("userId", "historical");

-- ── Order ──────────────────────────────────────────────────────────────────
ALTER TABLE "Order" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "txHash" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "historical" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX "Order_userId_historical_idx" ON "Order" ("userId", "historical");
CREATE INDEX "Order_status_historical_idx" ON "Order" ("status", "historical");
