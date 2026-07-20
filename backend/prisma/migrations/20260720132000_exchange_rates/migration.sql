-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "base_currency" TEXT NOT NULL DEFAULT 'EUR',
    "target_currency" TEXT NOT NULL,
    "rate" DECIMAL(19,8) NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_company_id_base_currency_target_currency_effe_key" ON "exchange_rates"("company_id", "base_currency", "target_currency", "effective_date");
CREATE INDEX "exchange_rates_company_id_target_currency_idx" ON "exchange_rates"("company_id", "target_currency");

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
