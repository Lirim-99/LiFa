-- AlterTable: make invoice_id nullable on fiscal_coupons
ALTER TABLE "fiscal_coupons" ALTER COLUMN "invoice_id" DROP NOT NULL;

-- AddColumn: credit_note_id to fiscal_coupons
ALTER TABLE "fiscal_coupons" ADD COLUMN "credit_note_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_coupons_credit_note_id_key" ON "fiscal_coupons"("credit_note_id");

-- AddForeignKey
ALTER TABLE "fiscal_coupons" ADD CONSTRAINT "fiscal_coupons_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
