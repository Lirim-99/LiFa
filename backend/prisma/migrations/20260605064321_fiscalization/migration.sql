-- CreateEnum
CREATE TYPE "FiscalProvider" AS ENUM ('NONE', 'MANUAL_EDI', 'ATK_EFS');

-- CreateEnum
CREATE TYPE "FiscalCouponStatus" AS ENUM ('PENDING', 'FISCALIZED', 'FAILED', 'VOIDED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "FiscalCouponType" AS ENUM ('SALE', 'RETURN');

-- CreateTable
CREATE TABLE "company_fiscal_configs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "FiscalProvider" NOT NULL DEFAULT 'NONE',
    "environment" TEXT NOT NULL DEFAULT 'TEST',
    "business_unit_code" TEXT,
    "operator_code" TEXT,
    "efs_software_code" TEXT,
    "efs_maintainer" TEXT,
    "verification_base_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_fiscal_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_coupons" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "status" "FiscalCouponStatus" NOT NULL DEFAULT 'PENDING',
    "coupon_type" "FiscalCouponType" NOT NULL DEFAULT 'SALE',
    "provider" "FiscalProvider" NOT NULL DEFAULT 'NONE',
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "fcuin" TEXT,
    "verification_url" TEXT,
    "qr_payload" TEXT,
    "tax_block_code" TEXT,
    "business_unit_code" TEXT,
    "operator_code" TEXT,
    "fiscalized_at" TIMESTAMP(3),
    "error_message" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_fiscal_configs_company_id_key" ON "company_fiscal_configs"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_coupons_invoice_id_key" ON "fiscal_coupons"("invoice_id");

-- CreateIndex
CREATE INDEX "fiscal_coupons_company_id_idx" ON "fiscal_coupons"("company_id");

-- CreateIndex
CREATE INDEX "fiscal_coupons_company_id_status_idx" ON "fiscal_coupons"("company_id", "status");

-- AddForeignKey
ALTER TABLE "company_fiscal_configs" ADD CONSTRAINT "company_fiscal_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_coupons" ADD CONSTRAINT "fiscal_coupons_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_coupons" ADD CONSTRAINT "fiscal_coupons_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
