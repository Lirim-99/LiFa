-- CreateEnum
CREATE TYPE "PosSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "PosSaleStatus" AS ENUM ('COMPLETED', 'VOIDED');
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "pos_registers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pos_registers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_sessions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "register_id" UUID NOT NULL,
    "opened_by" UUID NOT NULL,
    "closed_by" UUID,
    "status" "PosSessionStatus" NOT NULL DEFAULT 'OPEN',
    "opening_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "closing_balance" DECIMAL(19,4),
    "expected_balance" DECIMAL(19,4),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_sales" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sale_number" INTEGER NOT NULL,
    "status" "PosSaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "payment_method" "PosPaymentMethod" NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "change_given" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "invoice_id" UUID,
    "customer_name" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pos_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_sale_lines" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "product_service_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    CONSTRAINT "pos_sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_registers_company_id_idx" ON "pos_registers"("company_id");
CREATE INDEX "pos_sessions_company_id_idx" ON "pos_sessions"("company_id");
CREATE INDEX "pos_sessions_company_id_status_idx" ON "pos_sessions"("company_id", "status");
CREATE INDEX "pos_sales_company_id_idx" ON "pos_sales"("company_id");
CREATE INDEX "pos_sales_session_id_idx" ON "pos_sales"("session_id");
CREATE UNIQUE INDEX "pos_sales_invoice_id_key" ON "pos_sales"("invoice_id");
CREATE INDEX "pos_sale_lines_sale_id_idx" ON "pos_sale_lines"("sale_id");

-- AddForeignKey
ALTER TABLE "pos_registers" ADD CONSTRAINT "pos_registers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "pos_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pos_sales" ADD CONSTRAINT "pos_sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_sale_lines" ADD CONSTRAINT "pos_sale_lines_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "pos_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_sale_lines" ADD CONSTRAINT "pos_sale_lines_product_service_id_fkey" FOREIGN KEY ("product_service_id") REFERENCES "products_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
