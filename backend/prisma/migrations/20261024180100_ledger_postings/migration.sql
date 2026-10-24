-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN "accrual_journal_entry_id" UUID,
ADD COLUMN "payment_journal_entry_id" UUID;

ALTER TABLE "fixed_assets" ADD COLUMN "disposal_journal_entry_id" UUID;

ALTER TABLE "depreciation_entries" ADD COLUMN "journal_entry_id" UUID;

ALTER TABLE "invoices" ADD COLUMN "sales_order_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_accrual_journal_entry_id_key" ON "payroll_runs"("accrual_journal_entry_id");
CREATE UNIQUE INDEX "payroll_runs_payment_journal_entry_id_key" ON "payroll_runs"("payment_journal_entry_id");
CREATE UNIQUE INDEX "fixed_assets_disposal_journal_entry_id_key" ON "fixed_assets"("disposal_journal_entry_id");
CREATE INDEX "depreciation_entries_journal_entry_id_idx" ON "depreciation_entries"("journal_entry_id");
CREATE INDEX "invoices_sales_order_id_idx" ON "invoices"("sales_order_id");

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_accrual_journal_entry_id_fkey" FOREIGN KEY ("accrual_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payment_journal_entry_id_fkey" FOREIGN KEY ("payment_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_disposal_journal_entry_id_fkey" FOREIGN KEY ("disposal_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "depreciation_entries" ADD CONSTRAINT "depreciation_entries_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Protect the accounts the posting engine now depends on.
UPDATE "accounts" SET "is_system" = true WHERE "code" IN ('1500', '5100', '5200');

-- Seed missing accounts for companies created before this migration.
INSERT INTO "accounts" (
  "id", "company_id", "code", "name", "account_type", "normal_balance",
  "is_postable", "is_system", "is_active", "created_by", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  c."id",
  v.code,
  v.name,
  v.account_type::"AccountType",
  v.normal_balance::"NormalBalance",
  true,
  true,
  true,
  owner.user_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "companies" c
JOIN LATERAL (
  SELECT uca."user_id"
  FROM "user_company_access" uca
  WHERE uca."company_id" = c."id"
  ORDER BY uca."created_at"
  LIMIT 1
) owner ON true
CROSS JOIN (
  VALUES
    ('1510', 'Accumulated Depreciation', 'ASSET', 'DEBIT'),
    ('1600', 'Inventory', 'ASSET', 'DEBIT'),
    ('2400', 'Wages Payable', 'LIABILITY', 'CREDIT'),
    ('2410', 'Pension Payable', 'LIABILITY', 'CREDIT'),
    ('2420', 'Wage Tax Payable', 'LIABILITY', 'CREDIT'),
    ('4300', 'Gain on Disposal', 'REVENUE', 'CREDIT'),
    ('5500', 'Depreciation Expense', 'EXPENSE', 'DEBIT'),
    ('5600', 'Loss on Disposal', 'EXPENSE', 'DEBIT')
) AS v(code, name, account_type, normal_balance)
WHERE NOT EXISTS (
  SELECT 1 FROM "accounts" a WHERE a."company_id" = c."id" AND a."code" = v.code
);

-- Point the new roles at those accounts (existing codes included).
INSERT INTO "company_account_defaults" ("id", "company_id", "account_role", "account_id", "created_at", "updated_at")
SELECT gen_random_uuid(), a."company_id", m.role::"AccountRole", a."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "accounts" a
JOIN (
  VALUES
    ('1600', 'INVENTORY'),
    ('5100', 'COGS'),
    ('5200', 'SALARIES'),
    ('2400', 'WAGES_PAYABLE'),
    ('2410', 'PENSION_PAYABLE'),
    ('2420', 'WAGE_TAX_PAYABLE'),
    ('1500', 'FIXED_ASSET'),
    ('1510', 'ACCUMULATED_DEPRECIATION'),
    ('5500', 'DEPRECIATION_EXPENSE'),
    ('4300', 'DISPOSAL_GAIN'),
    ('5600', 'DISPOSAL_LOSS')
) AS m(code, role) ON m.code = a."code"
WHERE NOT EXISTS (
  SELECT 1 FROM "company_account_defaults" d
  WHERE d."company_id" = a."company_id" AND d."account_role" = m.role::"AccountRole"
);
