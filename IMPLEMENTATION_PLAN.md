# LiFa — MVP Implementation Plan

Version: 0.3 | Date: 2026-03-28 | Status: Draft
Source of truth: User specification (chat context) + PRODUCT_BRIEF.md v0.2

---

## Execution Principles

1. Each step produces a working, testable increment.
2. Core accounting flows are synchronous and transactional — no async event-driven ledger writes.
3. Internal events (`EventEmitter2`) are used only for non-critical side effects (notifications, activity feed, analytics, read-model refresh).
4. Every business table is company-scoped (`company_id`).
5. All money values use `Decimal(19,4)`. Never float.
6. Posted journal entries are immutable. Corrections via reversal + new entry. The original posted entry retains `status = POSTED` forever; a new reversal entry (also `POSTED`) nets it out.
7. Single currency (EUR) for MVP. Schema carries `currency` / `exchange_rate` fields (defaulting to `EUR` / `1.0`) to prepare for multi-currency without migration.
8. No microservices. No scope beyond MVP unless explicitly labeled as a recommendation.
9. Company scoping is enforced explicitly in every service/repository method — not via global Prisma auto-injection middleware.
10. Official document numbers (invoice numbers, journal entry numbers) are assigned only at the moment of issuance/posting — never on draft creation.
11. Payments in MVP require full allocation at creation time. No unallocated / "on-account" receipts in MVP.

---

## Design Decisions Clarified in This Revision

### D1 — Document Numbering: Assign on Issue/Post, Not on Draft

**Invoice numbers** are assigned inside the issue transaction, not when a draft is created. Draft invoices carry no official number — only their internal UUID. This avoids gaps in the official sequence when drafts are abandoned or deleted.

**Journal entry numbers** are assigned inside the post transaction, not when a draft is created. Draft journal entries carry no official number.

Both sequences are managed by a `DocumentSequence` table (see Step 2) with per-company, per-document-type, per-fiscal-year counters, using `SELECT ... FOR UPDATE` to guarantee gap-free numbering under concurrency. `fiscal_year` is a required (non-nullable) integer, which makes the unique constraint safe in PostgreSQL and naturally supports annual sequence resets.

### D2 — Journal Entry Void Semantics: Reversal-Based, No Status Mutation

When a journal entry is "voided":

- The **original entry stays `POSTED`** forever. Its status is never changed.
- A new **reversal entry** is created with `status = POSTED`. It has equal and opposite lines (debits become credits, credits become debits).
- The reversal entry's `reversal_of_entry_id` points to the original entry.
- The original entry's `reversed_by_entry_id` is set to point back to the reversal (bidirectional link for queries).

**Why**: Financial reports query `WHERE status = 'POSTED'`. If the original entry were set to `VOID`, its amounts would disappear from reports. With the reversal model, both entries are `POSTED` and their net effect is zero — reports remain mathematically correct without special-case status filtering.

**Status enum simplification**: `JournalEntryStatus` becomes `DRAFT` | `POSTED`. There is no `VOID` status. A posted entry that has been reversed is identified by having `reversed_by_entry_id IS NOT NULL`.

### D3 — MVP Payment Rule: Full Allocation Required

For MVP, every payment must be **fully allocated** to one or more invoices at creation time. There is no concept of unallocated / on-account receipts.

- `payment.total_amount` must equal the sum of all `allocation.allocated_amount` values.
- The `unallocated_amount` field is removed from the MVP schema.
- Payment status simplifies to: `RECORDED` (allocated and posted) or `VOID` (reversed).

**Needs accountant validation**: If the business requires accepting payments before invoicing (customer advances / deposits), a `Customer Advances` liability account and partial-allocation flow can be added post-MVP. The schema's `DocumentSequence` and `CompanyAccountDefaults` tables are designed to accommodate this extension.

### D4 — Company Account Defaults: Explicit Account-Role Mapping

The posting engine needs to know which accounts to debit/credit for system-generated journal entries. This is managed by a `CompanyAccountDefaults` table that maps account roles to specific company accounts.

MVP required mappings:

| Account Role          | Used By                                                    | Default CoA Code |
| --------------------- | ---------------------------------------------------------- | ---------------- |
| `ACCOUNTS_RECEIVABLE` | Invoice issue (debit), Payment recording (credit)          | 1300             |
| `CASH`                | Payment method = CASH (debit)                              | 1100             |
| `BANK`                | Payment method = BANK_TRANSFER (debit)                     | 1200             |
| `VAT_PAYABLE`         | Invoice issue with tax (credit)                            | 2200             |
| `SALES_REVENUE`       | Invoice issue fallback when no line-level account (credit) | 4100             |

On company creation, after the default chart of accounts is seeded, the `CompanyAccountDefaults` rows are populated by matching account codes. The user can remap these in company settings.

### D5 — Explicit Company Scoping (No Global Prisma Middleware)

Company isolation is enforced **explicitly in every service method**, not via a global Prisma middleware that auto-injects `company_id` into all queries.

Pattern:

```typescript
async findById(companyId: string, id: string) {
  const record = await this.prisma.invoice.findFirst({
    where: { id, company_id: companyId },
  });
  if (!record) throw new NotFoundException();
  return record;
}
```

Every service method that reads or writes company-scoped data takes `companyId` as an explicit parameter and includes it in the Prisma `where` clause. This makes the scoping visible, testable, and auditable at the code level.

PostgreSQL Row-Level Security (RLS) remains a **recommendation for defense-in-depth** in production but is not the primary isolation mechanism and is not required for MVP launch.

Automated tests verify that a service call with company A's ID cannot return company B's data.

### D6 — Audit: Explicit Logging in Service Methods, Not Generic Interceptor

For MVP, audit logging is done via **explicit calls to `AuditService.log()`** within the service methods that perform critical actions — not via a generic NestJS interceptor that tries to capture all writes automatically.

Rationale:

- A generic interceptor is fragile: it must infer entity type, action, and before/after state from the request/response shape, which varies across endpoints.
- Explicit calls are simpler, more reliable, and easier to test. The developer decides exactly what to log and with what context.
- The audit service is a simple injectable with one method. The cost of adding an explicit call is one line per critical action.

Pattern:

```typescript
async issueInvoice(companyId: string, invoiceId: string, userId: string) {
  // ... issue logic inside transaction ...
  await this.auditService.log({
    companyId, userId,
    entityType: 'INVOICE', entityId: invoiceId,
    action: 'ISSUED',
    before: { status: 'DRAFT' },
    after: { status: 'ISSUED', invoice_number: assigned },
  });
}
```

### D7 — Invoice Void Semantics (Aligned with D2)

When an invoice is voided:

1. A reversal journal entry is created (posted, reversal_of_entry_id points to original).
2. The original journal entry's `reversed_by_entry_id` is set.
3. The invoice's `status` is set to `VOID`.
4. The invoice's `voided_journal_entry_id` is set to the reversal entry's ID.

The invoice itself does use a VOID status (invoices are business documents, not ledger entries). But the underlying journal entries stay `POSTED` — the reversal nets them out.

---

## Step 1 — Monorepo & Dev Environment

**Goal:** Establish the workspace structure, tooling, and local development environment so every subsequent step has a runnable foundation.

### Mini-tasks

1.1. Initialize a pnpm workspace at the repo root with `pnpm-workspace.yaml` listing `backend/`, `frontend/`, `packages/shared/`.
1.2. Initialize `backend/` as a NestJS project (TypeScript, strict mode). Install core NestJS packages: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`.
1.3. Initialize `frontend/` as a Next.js 14+ project (App Router, TypeScript, strict mode).
1.4. Initialize `packages/shared/` as a plain TypeScript package for shared types, enums, and constants (e.g., `LegalForm`, `AccountType`, status enums).
1.5. Add a `docker-compose.yml` at the root with a PostgreSQL 16 service (port 5432, named volume for data persistence, sensible defaults for local dev).
1.6. Add Prisma to `backend/`: install `prisma` + `@prisma/client`, create an initial `prisma/schema.prisma` with the PostgreSQL datasource and generator block. Confirm `npx prisma db push` connects to the Docker Postgres.
1.7. Add ESLint + Prettier configs at root level, shared across workspaces. TypeScript strict, no-any rule, consistent semicolons/quotes.
1.8. Add a root `README.md` with: project description, prerequisites (Node 20+, pnpm, Docker), setup steps (`pnpm install`, `docker compose up -d`, `pnpm prisma db push`), and how to run each app.
1.9. Initialize Git, create `.gitignore` (node_modules, .env, dist, .next, prisma/\*.db), make initial commit.

### Expected Output

- Monorepo with three workspaces runnable locally.
- NestJS boots on `http://localhost:3001` and returns a health-check JSON.
- Next.js boots on `http://localhost:3000` and renders a placeholder page.
- PostgreSQL running via Docker, Prisma connected.
- Linting and formatting pass.

### Dependencies

None — this is the first step.

### Definition of Done

- `pnpm install` succeeds from root.
- `docker compose up -d` starts PostgreSQL.
- `pnpm --filter backend dev` starts NestJS; `GET /health` returns `{ "status": "ok" }`.
- `pnpm --filter frontend dev` starts Next.js; homepage renders.
- `npx prisma db push` runs without error.
- ESLint + Prettier pass with no errors.

---

## Step 2 — Prisma Schema (Full MVP Data Model)

**Goal:** Define all MVP tables in a single Prisma schema, generate the first migration, and seed the database with essential reference data.

### New/Changed Tables vs Previous Revision

| Change                            | Details                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NEW: `DocumentSequence`**       | Per-company, per-document-type sequential counters.                                                                                                                                              |
| **NEW: `CompanyAccountDefaults`** | Maps account roles (AR, Cash, Bank, VAT Payable, Sales Revenue) to company accounts.                                                                                                             |
| **CHANGED: `Invoice`**            | `invoice_number` is now **nullable** (null while in draft). Added `voided_journal_entry_id` (FK, nullable).                                                                                      |
| **CHANGED: `JournalEntry`**       | `entry_number` is now **nullable** (null while in draft). Status enum is now `DRAFT` \| `POSTED` (no VOID). Added `reversed_by_entry_id` (self-FK, nullable). Removed `voided_at` / `voided_by`. |
| **CHANGED: `Payment`**            | Removed `unallocated_amount`. Status enum is now `RECORDED` \| `VOID`.                                                                                                                           |
| **CHANGED: `Contact`**            | Added database-level CHECK constraint: `is_customer = true OR is_vendor = true`.                                                                                                                 |

### Mini-tasks

2.1. Define the following models in `prisma/schema.prisma`:

**Platform / Auth**

| Model               | Key notes                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `User`              | `id` (UUID), `first_name`, `last_name`, `email` (unique), `password_hash`, `is_active`, timestamps.                              |
| `Role`              | `id`, `code` (unique), `name`, `description`. System-seeded, not company-scoped.                                                 |
| `UserCompanyAccess` | `id`, `user_id` (FK), `company_id` (FK), `role_id` (FK), `is_default`, timestamps. Unique constraint on `(user_id, company_id)`. |

**Company**

| Model                        | Key notes                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Company`                    | `id` (UUID), all MVP fields: `legal_name`, `trade_name`, `legal_form` (enum), `uin_nui`, `fiscal_number`, `vat_number`, `registration_date`, `email`, `phone`, `website`, `default_currency` (default `EUR`), `fiscal_year_start_month` (default 1), timestamps, `created_by` (FK to User). |
| `CompanyAddress`             | `id`, `company_id` (FK), `address_type` (enum: REGISTERED, BUSINESS, OTHER), `country`, `municipality`, `city`, `street`, `postal_code`, `is_primary`, timestamps.                                                                                                                          |
| `CompanyActivityCode`        | `id`, `company_id` (FK), `activity_type` (enum: PRIMARY, SECONDARY), `code`, `description`, `sort_order`, timestamps.                                                                                                                                                                       |
| **`CompanyAccountDefaults`** | `id`, `company_id` (FK), `account_role` (enum: ACCOUNTS_RECEIVABLE, CASH, BANK, VAT_PAYABLE, SALES_REVENUE), `account_id` (FK to Account). Unique constraint on `(company_id, account_role)`.                                                                                               |

**Contacts**

| Model     | Key notes                                                                                                                                                                                                                                                                                                                                                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Contact` | `id`, `company_id` (FK), `is_customer` (Boolean, default false), `is_vendor` (Boolean, default false), `display_name`, `legal_name`, `email`, `phone`, `tax_id`, `payment_terms_days`, `currency`, `country`, `municipality`, `city`, `street`, `postal_code`, `is_active`, `notes`, timestamps, `created_by`. **Database CHECK constraint**: `is_customer = true OR is_vendor = true`. |

**Catalog**

| Model            | Key notes                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ProductService` | `id`, `company_id` (FK), `type` (enum: PRODUCT, SERVICE), `sku`, `name`, `description`, `unit`, `sale_price` (Decimal), `purchase_price` (Decimal), `income_account_id` (FK to Account, nullable), `expense_account_id` (FK to Account, nullable), `default_tax_rate_id` (FK to TaxRate, nullable), `is_active`, timestamps, `created_by`. |

**Tax**

| Model     | Key notes                                                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TaxRate` | `id`, `company_id` (FK, nullable — system defaults allowed), `name`, `code`, `rate` (Decimal), `calculation_type` (enum: EXCLUSIVE, INCLUSIVE), `scope` (enum: SALES, PURCHASES, BOTH), `is_default`, `is_active`, timestamps. |

**Accounting**

| Model              | Key notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Account`          | `id`, `company_id` (FK), `code`, `name`, `account_type` (enum: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE), `account_subtype` (String, flexible), `normal_balance` (enum: DEBIT, CREDIT), `parent_account_id` (self-FK, nullable), `is_postable`, `is_system`, `is_active`, timestamps, `created_by`. Unique constraint on `(company_id, code)`.                                                                                                                                                                                                                                                                                                                       |
| `AccountingPeriod` | `id`, `company_id` (FK), `fiscal_year` (Int), `period_number` (Int), `start_date`, `end_date`, `status` (enum: OPEN, CLOSED), `closed_at` (nullable), `closed_by` (FK, nullable), timestamps. Unique constraint on `(company_id, fiscal_year, period_number)`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `JournalEntry`     | `id`, `company_id` (FK), `entry_number` (String, **nullable** — null while draft, assigned on post), `entry_date`, `period_id` (FK, nullable — assigned on post), `source_document_type` (String, nullable), `source_document_id` (UUID, nullable), `memo`, `status` (enum: **DRAFT, POSTED** — no VOID), `posted_at` (nullable), `posted_by` (FK, nullable), `reversal_of_entry_id` (self-FK, nullable — set on reversal entry, points to original), `reversed_by_entry_id` (self-FK, nullable — set on original entry, points to reversal), timestamps, `created_by`. Unique constraint on `(company_id, entry_number)` — partial index, `entry_number IS NOT NULL`. |
| `JournalEntryLine` | `id`, `journal_entry_id` (FK), `line_number`, `account_id` (FK), `description`, `debit_amount` (Decimal 19,4), `credit_amount` (Decimal 19,4), `currency` (default EUR), `exchange_rate` (Decimal 19,4, default 1.0), `contact_id` (FK, nullable), `created_at`.                                                                                                                                                                                                                                                                                                                                                                                                       |

**Sales**

| Model         | Key notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invoice`     | `id`, `company_id` (FK), `invoice_number` (String, **nullable** — null while draft, assigned on issue), `contact_id` (FK), `issue_date`, `due_date`, `currency` (default EUR), `exchange_rate` (Decimal, default 1.0), `subtotal_amount` (Decimal), `tax_amount` (Decimal), `total_amount` (Decimal), `paid_amount` (Decimal, default 0), `balance_due` (Decimal), `status` (enum: DRAFT, ISSUED, PARTIALLY_PAID, PAID, VOID), `notes`, `posted_journal_entry_id` (FK to JournalEntry, nullable — set on issue), `voided_journal_entry_id` (FK to JournalEntry, nullable — set on void, points to the reversal entry), timestamps, `created_by`. Unique constraint on `(company_id, invoice_number)` — partial index, `invoice_number IS NOT NULL`. |
| `InvoiceLine` | `id`, `invoice_id` (FK), `line_number`, `product_service_id` (FK, nullable), `description`, `quantity` (Decimal), `unit_price` (Decimal), `discount_type` (enum, nullable), `discount_value` (Decimal, nullable), `tax_rate_id` (FK, nullable), `net_amount` (Decimal), `tax_amount` (Decimal), `total_amount` (Decimal), `income_account_id` (FK to Account, nullable), timestamps.                                                                                                                                                                                                                                                                                                                                                                |

**Payments**

| Model               | Key notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Payment`           | `id`, `company_id` (FK), `contact_id` (FK), `payment_type` (enum: RECEIVED — MVP is sales only; MADE reserved for post-MVP), `payment_method` (enum: **CASH, BANK_TRANSFER** — no OTHER in MVP), `payment_date`, `reference_number`, `currency` (default EUR), `exchange_rate` (Decimal, default 1.0), `total_amount` (Decimal), `status` (enum: **RECORDED, VOID**), `notes`, `posted_journal_entry_id` (FK, nullable), `voided_journal_entry_id` (FK, nullable — points to the reversal entry), timestamps, `created_by`. |
| `PaymentAllocation` | `id`, `payment_id` (FK), `invoice_id` (FK), `allocated_amount` (Decimal), `allocation_date`, `is_voided` (Boolean, default false), `voided_at` (DateTime, nullable), `created_at`, `created_by`.                                                                                                                                                                                                                                                                                                                            |

**Document Sequencing**

| Model                  | Key notes                                                                                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`DocumentSequence`** | `id`, `company_id` (FK), `document_type` (enum: INVOICE, JOURNAL_ENTRY), `fiscal_year` (Int, **required / non-nullable**), `prefix` (String), `last_number` (Int, default 0), `created_at`, `updated_at`. Unique constraint on `(company_id, document_type, fiscal_year)`. |

`fiscal_year` is required, not nullable. This avoids the PostgreSQL problem where `NULL != NULL` in unique constraints, which would allow duplicate rows with `fiscal_year = NULL`. Every sequence row is scoped to a specific year. When issuing an invoice or posting a journal entry, the service determines the fiscal year from the document's date and looks up (or creates) the matching sequence row.

Usage: `SELECT ... FOR UPDATE` on the row, increment `last_number`, format the document number as `{prefix}{last_number zero-padded}` (e.g., `INV-2026-00001`).

**Audit**

| Model      | Key notes                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuditLog` | `id`, `company_id` (FK), `user_id` (FK), `entity_type`, `entity_id`, `action`, `before_json` (Json, nullable), `after_json` (Json, nullable), `occurred_at`, `ip_address` (nullable). No update/delete operations ever. |

2.2. Define all enums as Prisma enums:

`LegalForm`, `AddressType`, `ActivityType`, `AccountRole`, `ProductServiceType`, `TaxCalculationType`, `TaxScope`, `AccountType`, `NormalBalance`, `PeriodStatus`, `InvoiceStatus`, `PaymentType`, `PaymentMethod`, `PaymentStatus`, `JournalEntryStatus`, `DocumentType`, `DiscountType`.

Note: `JournalEntryStatus` has only two values: `DRAFT`, `POSTED`.
Note: `PaymentStatus` has only two values: `RECORDED`, `VOID`.
Note: `PaymentMethod` has only two values for MVP: `CASH`, `BANK_TRANSFER`. Additional methods (card, mobile payment, etc.) can be added post-MVP with corresponding account-mapping rules.

2.3. Add appropriate indexes:

- `(company_id)` on every company-scoped table.
- `(company_id, code)` unique on `Account`.
- `(company_id, invoice_number)` unique on `Invoice` — partial: `WHERE invoice_number IS NOT NULL`.
- `(company_id, entry_number)` unique on `JournalEntry` — partial: `WHERE entry_number IS NOT NULL`.
- `(company_id, fiscal_year, period_number)` unique on `AccountingPeriod`.
- `(company_id, document_type, fiscal_year)` unique on `DocumentSequence` — all columns non-nullable, safe standard unique constraint.
- `(company_id, account_role)` unique on `CompanyAccountDefaults`.
- `(journal_entry_id, account_id)` on `JournalEntryLine` for ledger queries.
- `(company_id, entry_date, status)` on `JournalEntry` for report queries.
- `(company_id, entity_type, entity_id)` on `AuditLog`.
- `(user_id, company_id)` unique on `UserCompanyAccess`.

Note on partial unique indexes: Prisma does not natively support partial unique indexes. Implement via a raw SQL migration (`CREATE UNIQUE INDEX ... WHERE column IS NOT NULL`) added after the Prisma-generated migration.

2.4. Add database-level CHECK constraint on `Contact`:

- `CHECK (is_customer = true OR is_vendor = true)`.
- Implemented via raw SQL in the migration, since Prisma does not support CHECK constraints natively.

  2.5. Create a seed script (`prisma/seed.ts`) that inserts:

- System roles: `owner`, `admin`, `accountant`, `viewer`.
- System-level tax rate templates (company_id = null): Standard 18%, Reduced 8%, Zero/Exempt 0%. **Needs accountant validation**: confirm these are the correct Kosovo VAT rates and labels.

  2.6. Run `npx prisma migrate dev --name init` to generate the migration.

  2.7. Add raw SQL to the migration for:

- Partial unique index on `Invoice(company_id, invoice_number) WHERE invoice_number IS NOT NULL`.
- Partial unique index on `JournalEntry(company_id, entry_number) WHERE entry_number IS NOT NULL`.
- CHECK constraint on `Contact(is_customer OR is_vendor)`.
- Note: `DocumentSequence(company_id, document_type, fiscal_year)` uses a standard unique constraint — all columns are non-nullable, so no partial index is needed.

  2.8. Run `npx prisma db seed` to populate seed data.

### Expected Output

- `prisma/schema.prisma` — complete MVP schema with all models listed above.
- `prisma/migrations/` — initial migration SQL including raw additions.
- `prisma/seed.ts` — seed script for roles and tax rate templates.
- Database reflects all tables with correct types, constraints, and indexes.

### Dependencies

Step 1 (monorepo + Prisma + Docker Postgres).

### Definition of Done

- `npx prisma migrate dev` applies cleanly on a fresh database.
- `npx prisma db seed` populates roles and tax rate templates.
- `npx prisma studio` shows all tables with correct columns and types.
- All money columns are `Decimal(19,4)`.
- All company-scoped tables have a `company_id` column with a foreign key.
- `Invoice.invoice_number` and `JournalEntry.entry_number` are nullable.
- Partial unique indexes verified via `psql` or Prisma Studio.
- CHECK constraint on Contact verified: inserting a contact with both flags false raises an error.
- `DocumentSequence` and `CompanyAccountDefaults` tables exist.
- `JournalEntryStatus` enum has only DRAFT and POSTED.
- `PaymentStatus` enum has only RECORDED and VOID.
- Schema compiles with no Prisma validation errors.

---

## Step 3 — Backend Foundation (Common Layer)

**Goal:** Build the shared NestJS infrastructure that every module depends on: Prisma service, exception filters, decorators, validation, base DTOs, Decimal helpers.

### Mini-tasks

3.1. Create `PrismaModule` / `PrismaService` — wraps `@prisma/client`, implements `OnModuleInit` (connect) and `OnModuleDestroy` (disconnect). Exported globally. Exposes `$transaction()` for service-layer transactional flows.

3.2. **Explicit company-scoping pattern** (no global middleware):

- Document the convention: every service method that touches company-scoped data takes `companyId` as its first parameter and includes `company_id: companyId` in every Prisma `where`, `create`, etc.
- Create a `CompanyScopedService` abstract base class (optional helper — not required, but provides a clear pattern):
  ```typescript
  abstract class CompanyScopedService {
    protected ensureCompanyMatch(record: { company_id: string }, companyId: string) {
      if (record.company_id !== companyId) throw new NotFoundException();
    }
  }
  ```
- Write a test helper `expectCompanyIsolation(serviceFn, companyAId, companyBId)` that verifies company A's call cannot return company B's data.

  3.3. Create base exception filters:

- `HttpExceptionFilter` — consistent JSON error shape: `{ statusCode, message, error, timestamp, path }`.
- `PrismaExceptionFilter` — maps Prisma errors (unique constraint → 409, not found → 404, foreign key → 400, etc.).

  3.4. Create shared decorators:

- `@CurrentUser()` — parameter decorator that extracts user from request.
- `@CurrentCompany()` — parameter decorator that extracts company context from request.
- `@Public()` — method decorator that exempts a route from JWT auth.

  3.5. Create base validation setup:

- Install `class-validator` + `class-transformer`.
- Enable global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

  3.6. Create base DTO patterns:

- `PaginationQueryDto` (page, limit, sortBy, sortOrder).
- `PaginatedResponseDto<T>` (data, total, page, limit, totalPages).

  3.7. Create a Decimal utility helper:

- Wraps `Prisma.Decimal` for safe arithmetic in service layer.
- `add(a, b)`, `subtract(a, b)`, `multiply(a, b)`, `isEqual(a, b)`, `isZero(a)`, `isPositive(a)`, `isNegative(a)`, `sum(values[])`.
- All money math goes through this — never raw JS number arithmetic.

  3.8. Create a `DocumentSequenceService`:

- `nextNumber(tx, companyId, documentType, fiscalYear)`: within a Prisma transaction, locks the `DocumentSequence` row matching `(companyId, documentType, fiscalYear)` via `SELECT ... FOR UPDATE`, increments `last_number`, returns the formatted string (e.g., `INV-2026-00001` or `JE-2026-00001`).
- `fiscalYear` is required (Int). The calling service determines it from the document date and the company's fiscal year calendar.
- If no sequence row exists for the given combination (e.g., first invoice in a new fiscal year), creates one with the configured prefix and `last_number = 0`, then increments. This upsert is safe because the unique constraint on `(company_id, document_type, fiscal_year)` is fully non-nullable.
- This service is used by the sales module (invoice issue) and accounting module (journal entry post).

  3.9. Set up module structure convention:

- Each domain module folder contains: `module.ts`, `controller.ts`, `service.ts`, `dto/`, and optionally `interfaces/`.
- Document this convention in a short `backend/CONVENTIONS.md`.

### Expected Output

- `backend/src/prisma/` — PrismaModule + PrismaService.
- `backend/src/common/` — filters, decorators, pipes, DTOs, Decimal helpers, DocumentSequenceService.
- `backend/CONVENTIONS.md` — module structure and company-scoping conventions.

### Dependencies

Step 1 (NestJS project), Step 2 (Prisma schema for type generation).

### Definition of Done

- PrismaService connects and disconnects cleanly.
- Explicit company-scoping test helper works.
- `ValidationPipe` rejects invalid input with 400 and a clear message.
- Decimal helper has unit tests for arithmetic and balance checking.
- `DocumentSequenceService` has unit tests: concurrent calls produce unique, sequential numbers.
- All common infrastructure is importable by domain modules.

---

## Step 4 — Auth Module

**Goal:** Implement user registration, login, JWT session, and company-context switching.

### Mini-tasks

4.1. Install `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` (or `argon2`).

4.2. Create `AuthModule` with:

- `AuthService` — `register(dto)`, `login(dto)`, `validateUser(email, password)`.
- `AuthController` — `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` (recommended to avoid constant re-login).
- Registration creates a `User` record with hashed password.
- Login validates credentials, returns a JWT containing `{ userId, email }`.

  4.3. Create `JwtAuthGuard` (global guard applied to all routes except those decorated with `@Public()`).

  4.4. Create company-context resolution:

- `X-Company-Id` header on each request sets the active company in request context.
- A `CompanyGuard` validates that the authenticated user has `UserCompanyAccess` for the given company ID.
- If no company header is provided, fall back to the user's `is_default` company, or return 400 if none set.

  4.5. Create `UsersService` (within auth module or standalone):

- `findById(id)`, `findByEmail(email)`.
- `getCompanies(userId)` — returns all companies the user has access to, with roles.
- `switchCompany(userId, companyId)` — validates access, updates `is_default`.

  4.6. Write integration tests:

- Register → login → get JWT.
- Access protected endpoint without JWT → 401.
- Access endpoint with JWT but no valid company context → 400 or 403.
- Access endpoint with valid JWT + valid company → 200.

### Expected Output

- `backend/src/modules/auth/` — AuthModule, AuthService, AuthController, guards.
- JWT-based authentication working end-to-end.

### Dependencies

Step 2 (User, UserCompanyAccess tables), Step 3 (PrismaService, decorators, guards base).

### Definition of Done

- `POST /auth/register` creates user, returns 201.
- `POST /auth/login` returns JWT for valid credentials, 401 for invalid.
- All non-public routes return 401 without JWT.
- Company context is resolved and injected into request for all protected routes.
- Integration tests pass.

---

## Step 5 — Companies Module

**Goal:** Implement company CRUD and the company legal profile (addresses, activity codes). This is the data isolation boundary — all subsequent business data belongs to a company.

### Mini-tasks

5.1. Create `CompaniesModule` with:

- `CompaniesService` — `create(dto, userId)`, `findById(companyId)`, `update(companyId, dto, userId)`, `findByUser(userId)`.
- `CompaniesController` — `POST /companies`, `GET /companies`, `GET /companies/:id`, `PATCH /companies/:id`.

  5.2. Company creation flow — executed in a **single database transaction**:

1. Create the `Company` record.
2. Create a `UserCompanyAccess` record linking the creating user with the `owner` role.
3. Set `is_default = true` if this is the user's first company.
4. Create `DocumentSequence` rows for INVOICE and JOURNAL_ENTRY for the current fiscal year, with default prefixes (`INV-{YYYY}-`, `JE-{YYYY}-`). Since `fiscal_year` is required, we always create rows for a specific year.

**Seeding of accounting reference data**: Tax rates, chart of accounts, accounting periods, and company account defaults are NOT created here in Step 5 because those modules do not exist yet. Step 8 introduces a `CompanySetupService` that handles all default data seeding. Once Step 8 is built, the company creation transaction is updated to call `CompanySetupService.seedDefaults(companyId)` at the end, making the full creation flow:

```
POST /companies (single transaction):
  1. Create Company
  2. Create UserCompanyAccess (owner role)
  3. Create DocumentSequence rows (INVOICE + JOURNAL_ENTRY for current fiscal year)
  4. CompanySetupService.seedDefaults():           ← added in Step 8
     a. Copy system tax rate templates → company
     b. Seed default chart of accounts
     c. Generate accounting periods for current fiscal year
     d. Populate CompanyAccountDefaults (AR, Cash, Bank, VAT Payable, Sales Revenue)
```

Between Steps 5 and 8 during development, a newly created company will not have a chart of accounts or tax rates. This is acceptable because no module that needs those (invoicing, payments) exists yet. Once Step 8 is complete, the full creation flow is active and every subsequent company gets all defaults.

5.3. Create `CompanyLegalProfileController` (sub-resource):

- CRUD for `CompanyAddress`: `POST /companies/:id/addresses`, `GET`, `PATCH`, `DELETE`.
- CRUD for `CompanyActivityCode`: `POST /companies/:id/activity-codes`, `GET`, `PATCH`, `DELETE`.

  5.4. Create DTOs with validation:

- `CreateCompanyDto` — required: `legal_name`, `legal_form`. Optional: everything else.
- `UpdateCompanyDto` — all fields optional.
- `CreateCompanyAddressDto`, `CreateCompanyActivityCodeDto`, etc.
- Validate `legal_form` against the `LegalForm` enum.
- Validate `fiscal_year_start_month` is 1–12.

  5.5. All service methods take `companyId` explicitly. Company guard (from Step 4) ensures the authenticated user has access.

  5.6. Write tests:

- Create company → verify record + user access + owner role + document sequences created.
- Update company → verify fields persisted.
- Company isolation: user A cannot see user B's company.

### Expected Output

- `backend/src/modules/companies/` — full CRUD for companies, addresses, activity codes.
- Company creation sets up user-company link and document sequences.

### Dependencies

Step 4 (auth, user-company access model).

### Definition of Done

- `POST /companies` creates a company, links user as owner, creates document sequences.
- `GET /companies` returns only companies the current user has access to.
- `PATCH /companies/:id` updates fields.
- Address and activity code sub-resources work.
- Company isolation test passes.

---

## Step 6 — Permissions Module

**Goal:** Implement role-based access control so that different users within a company have appropriate access levels.

### Mini-tasks

6.1. Create `PermissionsModule` with:

- `PermissionsService` — `hasPermission(userId, companyId, permission)`, `getUserRole(userId, companyId)`.
- `PermissionsGuard` — reads a `@RequirePermission('invoice:create')` decorator and checks against the user's role.

  6.2. Define a hardcoded permission matrix for MVP:

| Action             | owner | admin | accountant | viewer |
| ------------------ | ----- | ----- | ---------- | ------ |
| company.update     | yes   | yes   | no         | no     |
| contacts.\*        | yes   | yes   | yes        | no     |
| catalog.\*         | yes   | yes   | yes        | no     |
| tax.\*             | yes   | yes   | yes        | no     |
| accounting.\*      | yes   | yes   | yes        | no     |
| invoices.\*        | yes   | yes   | yes        | no     |
| payments.\*        | yes   | yes   | yes        | no     |
| reports.read       | yes   | yes   | yes        | yes    |
| audit.read         | yes   | yes   | yes        | no     |
| permissions.manage | yes   | yes   | no         | no     |

6.3. Create `@RequirePermission(permission: string)` decorator.

6.4. Create endpoints for managing user access within a company:

- `POST /companies/:id/users` — invite/add a user with a role.
- `PATCH /companies/:id/users/:userId` — change role.
- `DELETE /companies/:id/users/:userId` — remove access.
- `GET /companies/:id/users` — list users with roles.

  6.5. Write tests:

- Owner can manage permissions; viewer cannot.
- Accountant can create invoices; viewer cannot.
- Role changes take effect immediately.

### Expected Output

- `backend/src/modules/permissions/` — guard, decorator, service, controller.

### Dependencies

Step 4 (auth, user-company access), Step 5 (company exists).

### Definition of Done

- `@RequirePermission` decorator blocks unauthorized access with 403.
- Permission matrix is enforced.
- User access management endpoints work.
- Tests confirm role-based access control.

---

## Step 7 — Contacts Module

**Goal:** Implement the flexible contact model (customer, vendor, or both) so that invoices and payments can reference contacts.

### Mini-tasks

7.1. Create `ContactsModule` with:

- `ContactsService` — `create(companyId, dto, userId)`, `findAll(companyId, filters)`, `findById(companyId, id)`, `update(companyId, id, dto)`, `deactivate(companyId, id)`.
- `ContactsController` — `POST /contacts`, `GET /contacts`, `GET /contacts/:id`, `PATCH /contacts/:id`.

All service methods take `companyId` as the first parameter and include it in every query.

7.2. Create DTOs with validation:

- `CreateContactDto` — required: `display_name`. Required: at least one of `is_customer` or `is_vendor` must be `true`. Validated at the DTO level with a custom class-validator decorator and at the database level with the CHECK constraint.
- `UpdateContactDto` — partial. If `is_customer` or `is_vendor` is being set to `false`, validate that the other remains `true`.
- `ContactFilterDto` — filter by `is_customer`, `is_vendor`, `is_active`, search by name/email.

  7.3. Implement list endpoint with:

- Pagination (`PaginatedResponseDto`).
- Filtering by customer/vendor flag.
- Search by name (case-insensitive `ILIKE`).
- Sorting by name, created date.

  7.4. Soft-deactivation: `PATCH` with `is_active: false`. Do not hard-delete contacts (they may be referenced by invoices).

  7.5. Write tests:

- Create customer contact → OK.
- Create vendor contact → OK.
- Create contact with both flags → OK.
- Create contact with neither flag → 400 (DTO validation) and database error (CHECK constraint).
- Update: set `is_customer = false` when `is_vendor` is already `false` → reject.
- Filter contacts by type.
- Deactivated contact excluded from default list.
- Company isolation: company A's contact is not visible to company B.

### Expected Output

- `backend/src/modules/contacts/` — full CRUD with filtering.

### Dependencies

Step 5 (company context).

### Definition of Done

- CRUD endpoints work for contacts.
- At-least-one-flag validation enforced at DTO and DB level.
- Filtering by customer/vendor works.
- Pagination works.
- Deactivated contacts excluded by default.
- Company isolation verified.

---

## Step 8 — Tax + Chart of Accounts + Accounting Periods + Company Defaults

**Goal:** Set up the four reference-data pillars that invoicing and journal entries depend on: tax rates, chart of accounts, accounting periods, and company account defaults. Wire these into company creation.

### Mini-tasks

#### 8A — Tax Rates

8A.1. Create `TaxModule` with:

- `TaxService` — `create(companyId, dto)`, `findAll(companyId)`, `findById(companyId, id)`, `update(companyId, id, dto)`, `deactivate(companyId, id)`.
- `TaxController` — `POST /tax-rates`, `GET /tax-rates`, `GET /tax-rates/:id`, `PATCH /tax-rates/:id`.

8A.2. Tax rate calculation helper:

- `calculateExclusive(netAmount, rate)` → `{ taxAmount, grossAmount }`.
- `calculateInclusive(grossAmount, rate)` → `{ netAmount, taxAmount }`.
- **Needs accountant validation**: confirm whether Kosovo businesses predominantly use tax-exclusive or tax-inclusive pricing on invoices.

#### 8B — Chart of Accounts

8B.1. Extend `AccountingModule` with:

- `AccountsService` — `create(companyId, dto, userId)`, `findAll(companyId, filters)`, `findById(companyId, id)`, `update(companyId, id, dto)`, `deactivate(companyId, id)`.
- `AccountsController` — `POST /accounts`, `GET /accounts`, `GET /accounts/:id`, `PATCH /accounts/:id`.

8B.2. Define a default chart of accounts template as a JSON/TypeScript data file:

- **Needs accountant validation**: exact Kosovo-standard CoA structure. For now, a reasonable IFRS-for-SMEs-aligned placeholder:
  - 1xxx Assets (1100 Cash, 1200 Bank, 1300 Accounts Receivable, 1500 Fixed Assets)
  - 2xxx Liabilities (2100 Accounts Payable, 2200 VAT Payable, 2300 Loans)
  - 3xxx Equity (3100 Share Capital, 3200 Retained Earnings)
  - 4xxx Revenue (4100 Sales Revenue, 4200 Service Revenue)
  - 5xxx Expenses (5100 COGS, 5200 Salaries, 5300 Rent, 5400 Utilities)
- System accounts marked `is_system = true`: AR, AP, Cash, Bank, Sales Revenue, VAT Payable, Retained Earnings. Cannot be deleted.

8B.3. Validation rules:

- Account code unique within company.
- Cannot deactivate an account that has posted journal entry lines.
- Cannot make a parent account postable if it has children.

#### 8C — Accounting Periods

8C.1. `PeriodsService` — `generate(companyId, fiscalYear)`, `findAll(companyId)`, `findForDate(companyId, date)`, `close(companyId, periodId, userId)`, `reopen(companyId, periodId, userId)`.

8C.2. `PeriodsController` — `POST /accounting-periods/generate`, `GET /accounting-periods`, `PATCH /accounting-periods/:id/close`, `PATCH /accounting-periods/:id/reopen`.

8C.3. Period generation: based on `fiscal_year_start_month`, generate 12 monthly periods, all OPEN.

8C.4. Period closing: sets status CLOSED. Blocked if DRAFT journal entries exist in the period.

8C.5. Period reopening: only owner/admin. Sets status OPEN.

#### 8D — Company Account Defaults

8D.1. `CompanyAccountDefaultsService`:

- `getDefaults(companyId)` — returns the current account-role mappings.
- `getAccountForRole(companyId, accountRole)` — returns the account ID for a specific role. Throws if not configured.
- `setDefault(companyId, accountRole, accountId)` — creates or updates a mapping.

8D.2. `CompanyAccountDefaultsController`:

- `GET /company-account-defaults` — returns all defaults for the current company.
- `PUT /company-account-defaults/:role` — set or update one default.

#### 8E — Company Setup Service (Wiring It All Together)

8E.1. Create `CompanySetupService` within the companies module (or a shared setup module) that orchestrates default data seeding:

```
CompanySetupService.seedDefaults(companyId, fiscalYearStartMonth):
  1. Copy system tax rate templates → company-specific tax rates.
  2. Seed default chart of accounts for the company.
  3. Generate accounting periods for the current fiscal year.
  4. Populate CompanyAccountDefaults by matching account codes:
     - ACCOUNTS_RECEIVABLE → code 1300
     - CASH → code 1100
     - BANK → code 1200
     - VAT_PAYABLE → code 2200
     - SALES_REVENUE → code 4100
```

8E.2. Update the company creation flow (Step 5) to call `CompanySetupService.seedDefaults()` at the end of the creation transaction.

8E.3. Write tests:

- Create company → verify tax rates, accounts, periods, and account defaults all seeded.
- `getAccountForRole(companyId, 'ACCOUNTS_RECEIVABLE')` → returns account with code 1300.
- User changes the AR default to a different account → `getAccountForRole` returns the new one.

### Expected Output

- `backend/src/modules/tax/` — tax rate CRUD + calculation helper.
- `backend/src/modules/accounting/` — accounts CRUD + periods CRUD.
- `CompanyAccountDefaults` service and controller.
- `CompanySetupService` that seeds all reference data on company creation.

### Dependencies

Step 5 (company creation), Step 3 (Decimal helpers).

### Definition of Done

- Tax rates CRUD works. Calculation helper has unit tests.
- Chart of accounts CRUD works. Default accounts seeded on company creation.
- Accounting periods generated on company creation.
- CompanyAccountDefaults populated on company creation with correct account mappings.
- `getAccountForRole()` returns the correct account for each role.
- Cannot deactivate a system account.
- Cannot close a period with draft entries.
- All company-scoped and tested for isolation.

---

## Step 9 — Catalog Module (Products & Services)

**Goal:** Implement the product/service catalog so invoice lines can reference items.

### Mini-tasks

9.1. Create `CatalogModule` with:

- `CatalogService` — `create(companyId, dto, userId)`, `findAll(companyId, filters)`, `findById(companyId, id)`, `update(companyId, id, dto)`, `deactivate(companyId, id)`.
- `CatalogController` — `POST /products-services`, `GET /products-services`, `GET /products-services/:id`, `PATCH /products-services/:id`.

  9.2. Create DTOs:

- `CreateProductServiceDto` — required: `name`, `type`. Optional: `sku`, `unit`, `sale_price`, `purchase_price`, `income_account_id`, `expense_account_id`, `default_tax_rate_id`.
- Validate that referenced `income_account_id` / `expense_account_id` exist and belong to the same company.
- Validate that `default_tax_rate_id` exists and belongs to the same company.

  9.3. Filtering: by type (product/service), active/inactive, search by name.

  9.4. Write tests.

### Expected Output

- `backend/src/modules/catalog/` — full CRUD.

### Dependencies

Step 8 (accounts and tax rates must exist to be referenced).

### Definition of Done

- CRUD works. Foreign key validation on account and tax rate references.
- Filtering and pagination work.
- Company-scoped.

---

## Step 10 — Audit Module

**Goal:** Implement the append-only audit log service and read endpoint. Audit logging is done via explicit service calls, not a generic interceptor.

### Mini-tasks

10.1. Create `AuditModule` with:

- `AuditService` — one method: `log(params: AuditLogParams)`.
  ```typescript
  interface AuditLogParams {
    companyId: string;
    userId: string;
    entityType: string;
    entityId: string;
    action: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    ipAddress?: string;
  }
  ```
- `AuditController` — `GET /audit-logs` (read-only, with pagination and filters by entity type, action, date range, user).

  10.2. The `AuditService.log()` method:

- Creates an `AuditLog` record.
- Always sets `occurred_at` to `new Date()`.
- Does NOT throw on failure — audit logging should not break the calling flow. Log the error to the application logger instead.
- Can be called inside or outside a transaction. When called inside a transaction, the audit entry is committed or rolled back with the rest of the transaction.

  10.3. Define MVP audit coverage (per product brief §2.11):

- Company setup changes.
- Chart of accounts changes (create, update, deactivate).
- Invoice create / issue / void.
- Payment create / allocate / void.
- Journal entry create / post / void.
- Role/access changes.

  10.4. Go back and add explicit `this.auditService.log(...)` calls to the relevant service methods in Steps 5, 6, 7, 8. This is a cross-cutting pass. For each critical action:

- Inject `AuditService` into the module's service.
- Call `this.auditService.log(...)` after the successful operation (or inside the transaction for transactional operations).

  10.5. Write tests:

- Verify audit entry created when `AuditService.log()` is called.
- Verify `GET /audit-logs` returns paginated, filterable results.
- Verify no update or delete endpoints exist on audit logs.

### Expected Output

- `backend/src/modules/audit/` — service and controller.
- Explicit audit calls added to existing critical service methods.

### Dependencies

Step 3 (PrismaService), Steps 5–9 (services to add audit calls to).

### Definition of Done

- `AuditService.log()` creates audit records.
- `GET /audit-logs` returns filterable, paginated results.
- No update or delete endpoints.
- Audit calls present in all critical service methods per MVP scope.

---

## Step 11 — Sales Invoicing Module

**Goal:** Implement the full sales invoice lifecycle: create draft → issue (with transactional journal posting and number assignment) → void (with reversal entry).

### Mini-tasks

11.1. Create `SalesModule` with:

- `InvoicesService` — `create(companyId, dto, userId)`, `findAll(companyId, filters)`, `findById(companyId, id)`, `update(companyId, id, dto)`, `issue(companyId, id, userId)`, `void(companyId, id, userId)`, `delete(companyId, id)`.
- `InvoicesController` — `POST /invoices`, `GET /invoices`, `GET /invoices/:id`, `PATCH /invoices/:id`, `POST /invoices/:id/issue`, `POST /invoices/:id/void`, `DELETE /invoices/:id`.

  11.2. **Invoice creation** (draft):

- Status = DRAFT.
- `invoice_number = null` — no official number assigned yet.
- Validate `contact_id` exists, belongs to the same company, and `is_customer = true`.
- Validate all line items: product reference (if provided), tax rate reference, account reference.
- Calculate line totals and invoice totals.
- Drafts can be freely edited and deleted.

  11.3. **Invoice line calculation**:

- For each line: `net_amount = quantity * unit_price - discount`.
- Tax amount calculated using the tax rate and its calculation type (exclusive/inclusive).
- `total_amount = net_amount + tax_amount`.
- Invoice header totals: `subtotal_amount = sum(line net_amounts)`, `tax_amount = sum(line tax_amounts)`, `total_amount = sum(line total_amounts)`, `balance_due = total_amount`.

  11.4. **Issue invoice** — the most critical flow in MVP:

```
Within a single database transaction (this.prisma.$transaction):

1. Load and validate invoice:
   - Must be DRAFT.
   - Must have at least one line.
   - contact_id must exist and be an active customer.

2. Recalculate all line totals and header totals (defensive).

3. Determine the accounting period:
   - Find the OPEN period that contains issue_date.
   - If no open period found → reject with clear error.

4. Assign invoice number:
   - Call DocumentSequenceService.nextNumber(tx, companyId, 'INVOICE', fiscalYear).
   - Returns e.g. "INV-2026-00001".

5. Look up company account defaults:
   - CompanyAccountDefaultsService.getAccountForRole(companyId, 'ACCOUNTS_RECEIVABLE').
   - CompanyAccountDefaultsService.getAccountForRole(companyId, 'SALES_REVENUE').
   - CompanyAccountDefaultsService.getAccountForRole(companyId, 'VAT_PAYABLE').

6. Create a JournalEntry:
   - source_document_type = 'INVOICE'
   - source_document_id = invoice.id
   - entry_date = invoice.issue_date
   - status = POSTED
   - posted_at = now
   - posted_by = userId

7. Assign journal entry number:
   - Call DocumentSequenceService.nextNumber(tx, companyId, 'JOURNAL_ENTRY', fiscalYear).

8. Set period_id on journal entry.

9. Create JournalEntryLines:
   - DEBIT  Accounts Receivable       → invoice.total_amount
   - CREDIT per-line revenue account   → line.net_amount (use line's income_account_id if set, else company SALES_REVENUE default)
   - CREDIT VAT Payable               → invoice.tax_amount (if > 0)

10. Validate: sum(debits) == sum(credits). If not → throw (this is a bug, not a user error).

11. Update invoice:
    - invoice_number = assigned number
    - status = ISSUED
    - posted_journal_entry_id = journalEntry.id

12. Write audit log entry.

If ANY step fails → entire transaction rolls back.
Invoice stays DRAFT with no number. No partial state.
```

11.5. **Void invoice**:

```
Within a single database transaction:

1. Load invoice. Must be ISSUED with balance_due == total_amount (no payments allocated).
2. Load the original journal entry (via posted_journal_entry_id).
3. Create a REVERSAL journal entry:
   - source_document_type = 'INVOICE_VOID'
   - source_document_id = invoice.id
   - status = POSTED
   - reversal_of_entry_id = original journal entry's ID
   - Lines: mirror the original, debits↔credits swapped.
   - Assign entry_number via DocumentSequenceService.
   - Set period_id.
4. Set original journal entry's reversed_by_entry_id = reversal entry ID.
5. Update invoice:
   - status = VOID
   - voided_journal_entry_id = reversal entry ID
6. Write audit log entry.

If ANY step fails → rolls back.
```

Note: the original journal entry's status remains `POSTED`. It is not changed to VOID. The reversal entry, also `POSTED`, nets it out. Reports that sum POSTED lines will correctly show zero net effect.

11.6. **Draft editing**:

- DRAFT invoices can be freely edited (lines added/removed/changed, dates changed, contact changed).
- ISSUED/PAID/VOID invoices cannot be edited. No exceptions.
- DRAFT invoices can be deleted entirely.

  11.7. Write comprehensive tests:

- Create draft → no invoice_number assigned.
- Issue invoice → invoice_number assigned, journal entry created and posted with entry_number, balanced.
- Issue two invoices → numbers are sequential, no gaps.
- Issue invoice in closed period → reject.
- Issue invoice when AR default account not configured → reject with clear error.
- Void issued invoice → reversal entry created (POSTED), original entry still POSTED, original entry has reversed_by_entry_id set, invoice is VOID.
- Void invoice with payments → reject.
- Edit draft → OK. Edit issued → reject.
- Delete draft → OK. Delete issued → reject.
- Transaction rollback: simulate failure mid-issue → invoice stays DRAFT, no number consumed.

### Expected Output

- `backend/src/modules/sales/` — invoices CRUD + issue + void.
- Reusable journal entry creation logic (extracted into a helper or shared service for Step 12 and 13).

### Dependencies

Step 7 (contacts), Step 8 (accounts, periods, tax rates, account defaults), Step 9 (catalog), Step 3 (DocumentSequenceService, Decimal helpers).

### Definition of Done

- Full invoice lifecycle: DRAFT → ISSUED → VOID.
- Invoice numbers assigned only on issue, gap-free.
- Journal entry numbers assigned only on post, gap-free.
- Issuing creates a balanced, posted journal entry in one transaction.
- Void creates a posted reversal entry; original entry stays POSTED.
- Account defaults are used for AR, Revenue, VAT Payable.
- Cannot issue in closed period.
- Cannot void if payments exist.
- Cannot edit or delete issued invoice.
- All money is Decimal.
- Integration tests cover happy path and all failure modes.

---

## Step 12 — Journal Entries Module (Manual)

**Goal:** Implement manual journal entry creation for accountant adjustments, independent of invoices/payments.

### Mini-tasks

12.1. Extend `AccountingModule` with:

- `JournalEntriesService` — `create(companyId, dto, userId)`, `findAll(companyId, filters)`, `findById(companyId, id)`, `update(companyId, id, dto)`, `post(companyId, id, userId)`, `void(companyId, id, userId)`, `delete(companyId, id)`.
- `JournalEntriesController` — `POST /journal-entries`, `GET /journal-entries`, `GET /journal-entries/:id`, `PATCH /journal-entries/:id`, `POST /journal-entries/:id/post`, `POST /journal-entries/:id/void`, `DELETE /journal-entries/:id`.

  12.2. **Manual journal entry creation** (draft):

- Status = DRAFT.
- `entry_number = null` — no official number yet.
- `source_document_type = 'MANUAL'`, `source_document_id = null`.
- User provides: entry_date, memo, lines (account_id, debit_amount, credit_amount, description).
- Drafts can be freely edited and deleted.

  12.3. **Post journal entry**:

```
Within a single database transaction:

1. Validate entry is DRAFT.
2. Validate total debits == total credits (Decimal comparison).
3. Validate entry_date falls in an OPEN accounting period.
4. Validate all account_ids exist, belong to the company, and are postable.
5. Assign entry_number via DocumentSequenceService.nextNumber(tx, companyId, 'JOURNAL_ENTRY', fiscalYear).
6. Assign period_id based on entry_date.
7. Set status = POSTED, posted_at = now, posted_by = userId.
8. Write audit log entry.

If validation fails → return error, entry stays DRAFT, no number consumed.
```

12.4. **Void journal entry** (manual entries only):

```
Within a single database transaction:

1. Validate entry is POSTED.
2. Validate entry has source_document_type = 'MANUAL'.
   System-generated entries (INVOICE, PAYMENT) must be voided through their
   source document, not directly.
3. Validate entry has NOT already been reversed (reversed_by_entry_id IS NULL).
4. Create a reversal entry:
   - status = POSTED
   - reversal_of_entry_id = original entry ID
   - Lines: mirror original, debits↔credits swapped.
   - Assign entry_number.
   - Set period_id.
5. Set original entry's reversed_by_entry_id = reversal entry ID.
6. Write audit log entry.
```

Note: the original entry's status stays `POSTED`. The reversal entry nets it out.

12.5. **Draft editing and deletion**:

- DRAFT entries can be freely edited or deleted.
- POSTED entries are immutable — cannot edit, cannot delete.

  12.6. **Listing and filtering**:

- Filter by status (DRAFT, POSTED).
- Filter by source type (MANUAL, INVOICE, PAYMENT, INVOICE_VOID, PAYMENT_VOID).
- Filter by date range.
- Filter by reversed status: show "reversed" indicator if `reversed_by_entry_id IS NOT NULL`.
- Pagination.

  12.7. Write tests:

- Create draft → no entry_number.
- Post → entry_number assigned, status POSTED, period set.
- Unbalanced entry → cannot post.
- Closed period → cannot post.
- Void manual entry → reversal created (POSTED), original still POSTED, reversed_by set.
- Void system-generated entry directly → reject.
- Void already-reversed entry → reject.
- Edit draft → OK. Edit posted → reject.
- Delete draft → OK. Delete posted → reject.

### Expected Output

- Journal entry CRUD + post + void endpoints in `AccountingModule`.

### Dependencies

Step 8 (accounts, periods), Step 3 (DocumentSequenceService).

### Definition of Done

- Manual journal entries: create DRAFT, edit, delete, post, void.
- Entry numbers assigned only on post, gap-free.
- Balance validation enforced on post.
- Period validation enforced.
- Posted entries are immutable.
- Reversal-based void: original stays POSTED.
- System-generated entries protected from direct void.
- Already-reversed entries protected from double-void.

---

## Step 13 — Payments Module

**Goal:** Implement payment recording with full allocation to invoices and transactional journal posting.

### Mini-tasks

13.1. Create `PaymentsModule` with:

- `PaymentsService` — `create(companyId, dto, userId)`, `findAll(companyId, filters)`, `findById(companyId, id)`, `void(companyId, id, userId)`.
- `PaymentsController` — `POST /payments`, `GET /payments`, `GET /payments/:id`, `POST /payments/:id/void`.

Note: there is no separate "allocate" endpoint. In MVP, allocation is part of payment creation. The full amount must be allocated.

13.2. **Record payment with full allocation** — transactional flow:

```
Within a single database transaction:

1. Validate contact_id exists, belongs to company, is_customer = true.

2. Validate allocations:
   - dto.allocations must not be empty.
   - Sum of all allocation amounts must equal dto.total_amount exactly (Decimal comparison).
     If not → reject with "Payment must be fully allocated in MVP".
   - For each allocation:
     a. Invoice exists, belongs to same company, status is ISSUED or PARTIALLY_PAID.
     b. Invoice's contact_id matches payment's contact_id.
     c. allocation.amount > 0.
     d. allocation.amount <= invoice.balance_due.

3. Create Payment record:
   - status = RECORDED
   - payment_type = RECEIVED

4. For each allocation:
   a. Create PaymentAllocation record.
   b. Update invoice:
      - paid_amount += allocation.amount
      - balance_due -= allocation.amount
      - status → PAID if balance_due == 0, else PARTIALLY_PAID.

5. Look up company account defaults:
   - Determine debit account based on payment_method:
     CASH → CompanyAccountDefaults.CASH
     BANK_TRANSFER → CompanyAccountDefaults.BANK
   - Credit account: CompanyAccountDefaults.ACCOUNTS_RECEIVABLE
   - (No OTHER method in MVP — every payment maps unambiguously to a known account.
      Post-MVP: adding OTHER will require either a user-selected receiving account per payment
      or an additional account role in CompanyAccountDefaults.)

6. Create JournalEntry:
   - source_document_type = 'PAYMENT'
   - source_document_id = payment.id
   - entry_date = payment.payment_date
   - status = POSTED

7. Assign entry_number via DocumentSequenceService.

8. Set period_id based on payment_date.

9. Create JournalEntryLines:
   - DEBIT  Cash/Bank             → payment.total_amount
   - CREDIT Accounts Receivable   → payment.total_amount

10. Validate balanced.

11. Set payment.posted_journal_entry_id = journalEntry.id.

12. Write audit log entry.

If ANY step fails → entire transaction rolls back.
```

13.3. **Void payment**:

```
Within a single database transaction:

1. Load payment. Must be RECORDED.
2. Load all active allocations for this payment (WHERE is_voided = false).
3. For each allocation:
   a. Update invoice:
      - paid_amount -= allocation.allocated_amount
      - balance_due += allocation.allocated_amount
      - status → recalculate: if paid_amount == 0 → ISSUED, else PARTIALLY_PAID.
   b. Mark allocation as voided: set is_voided = true, voided_at = now.
      Do NOT delete the PaymentAllocation record — it is preserved for audit history.
4. Load original journal entry (via posted_journal_entry_id).
5. Create reversal journal entry (POSTED, reversal_of_entry_id set, lines swapped).
6. Set original journal entry's reversed_by_entry_id.
7. Assign entry_number to reversal.
8. Update payment:
   - status = VOID
   - voided_journal_entry_id = reversal entry ID
9. Write audit log entry.
```

Allocation queries throughout the system (e.g., "how much has been paid on this invoice") must filter `WHERE is_voided = false` to exclude voided allocations. The voided records remain in the table for audit trail purposes.

13.4. Write tests:

- Record fully-allocated payment to single invoice → invoice PAID, journal entry posted.
- Record payment split across two invoices → both updated correctly.
- Partial payment (allocation < invoice total) → invoice PARTIALLY_PAID.
- Allocation sum != payment total → reject.
- Allocation exceeds invoice balance_due → reject.
- Payment contact != invoice contact → reject.
- Void payment → invoice balances restored, reversal entry created.
- Transaction rollback on failure.

### Expected Output

- `backend/src/modules/payments/` — full payment lifecycle.

### Dependencies

Step 7 (contacts), Step 8 (accounts, periods, account defaults), Step 11 (invoices, journal entry logic), Step 3 (DocumentSequenceService).

### Definition of Done

- Payment + full allocation + journal posting works in one transaction.
- Sum of allocations must equal payment total.
- Invoice statuses update correctly.
- Void reverses everything correctly (reversal-based, original journal entry stays POSTED).
- Cannot over-allocate. Cannot partially-allocate.
- All money is Decimal.
- Integration tests pass.

---

## Step 14 — Reports Module

**Goal:** Implement the five core financial reports: Trial Balance, General Ledger, Profit & Loss, Balance Sheet, AR Aging.

### Mini-tasks

14.1. Create `ReportsModule` with:

- `ReportsService` — methods for each report.
- `ReportsController` — `GET /reports/trial-balance`, `GET /reports/general-ledger`, `GET /reports/profit-and-loss`, `GET /reports/balance-sheet`, `GET /reports/ar-aging`.

  14.2. **Report query rule**: All reports query `journal_entry_lines` joined with `journal_entries` WHERE `journal_entries.status = 'POSTED'`. Since we use reversal-based voiding (no VOID status), all posted entries — including originals and their reversals — are included. Reversed entries are automatically netted out because the reversal has equal-and-opposite amounts.

  14.3. **Trial Balance** — `GET /reports/trial-balance?periodId=X` or `?startDate=X&endDate=X`:

- For each account: sum all POSTED journal entry line debits and credits within the date/period range.
- Return: account code, name, type, total debits, total credits, net balance.
- Verify: total debits == total credits (if not, flag as error).

  14.4. **General Ledger** — `GET /reports/general-ledger?accountId=X&startDate=X&endDate=X`:

- All POSTED journal entry lines for the given account within date range.
- Include: date, entry number, description, memo, debit, credit, running balance.
- Reversed entries are included and visible (they net to zero).
- Pagination supported.

  14.5. **Profit & Loss** — `GET /reports/profit-and-loss?startDate=X&endDate=X`:

- Revenue accounts: sum(credits) - sum(debits).
- Expense accounts: sum(debits) - sum(credits).
- Net income = total revenue - total expenses.
- Group by account.

  14.6. **Balance Sheet** — `GET /reports/balance-sheet?asOfDate=X`:

- Assets: sum(debit - credit) for ASSET accounts up to asOfDate.
- Liabilities: sum(credit - debit) for LIABILITY accounts up to asOfDate.
- Equity: sum for EQUITY accounts + current-year net income.
- Verify: Assets == Liabilities + Equity.

  14.7. **AR Aging** — `GET /reports/ar-aging?asOfDate=X`:

- All ISSUED or PARTIALLY_PAID invoices with balance_due > 0 as of asOfDate.
- Bucket by age: Current (0–30), 31–60, 61–90, 91+ days.
- Group by contact.

  14.8. All reports read-only. Permission: `reports.read` (all roles).

  14.9. Write tests:

- Seed known data → verify trial balance balances.
- Issue invoice + void → trial balance shows zero net effect.
- Verify P&L totals.
- Verify balance sheet equation.
- Verify AR aging buckets.

### Expected Output

- `backend/src/modules/reports/` — five report endpoints.

### Dependencies

Step 11 (invoices), Step 12 (journal entries), Step 13 (payments).

### Definition of Done

- All five reports return correct data.
- Trial balance is balanced (including after voids).
- Reversal entries are correctly included and netted.
- Balance sheet equation holds.
- Reports are read-only.
- Pagination works on General Ledger.

---

## Step 15 — Frontend Foundation

**Goal:** Set up the Next.js frontend shell: auth pages, layout, navigation, API client, company switcher.

### Mini-tasks

15.1. Set up the project structure:

```
frontend/src/
  app/
    (auth)/           → login, register (no sidebar)
    (app)/            → authenticated app shell (sidebar + header)
      dashboard/
      companies/
      contacts/
      products-services/
      invoices/
      payments/
      journal-entries/
      reports/
      settings/
      audit-log/
  components/
    ui/               → shadcn/ui components
    layout/           → Sidebar, Header, CompanySwitcher
    forms/            → reusable form patterns
    tables/           → reusable table/DataTable component
  lib/
    api-client.ts     → fetch wrapper with JWT + company header
    auth.ts           → token storage, auth state
    utils.ts          → formatting (currency, dates)
  hooks/
    use-auth.ts
    use-company.ts
    use-pagination.ts
  types/              → mirrors backend DTOs
```

15.2. Install and configure UI dependencies:

- Tailwind CSS 4.
- shadcn/ui components.
- `react-hook-form` + `zod` for form validation.
- `@tanstack/react-query` for data fetching/caching.
- `date-fns` for date formatting.

  15.3. Build the API client:

- Wraps `fetch`.
- Automatically attaches `Authorization: Bearer <token>` header.
- Automatically attaches `X-Company-Id: <companyId>` header.
- Handles 401 → redirect to login.
- Handles validation errors → parse and return field errors.
- Typed request/response.

  15.4. Build auth pages:

- `/login` — email + password form.
- `/register` — registration form, auto-login on success.
- Redirect to `/dashboard` or company creation wizard if no companies.

  15.5. Build the app shell layout:

- Sidebar navigation.
- Header with company name, company switcher, user menu.
- Responsive: sidebar collapses on mobile.

  15.6. Build dashboard page (placeholder):

- Welcome message, placeholder metric cards.

  15.7. Build a reusable `DataTable` component:

- Columns, sorting, pagination, row actions, search input.

### Expected Output

- Frontend shell with auth, layout, company switcher, reusable components.

### Dependencies

Step 4 (auth API), Step 5 (companies API).

### Definition of Done

- Register → login → see dashboard.
- Company switcher works.
- Sidebar navigation works.
- Responsive layout works.

---

## Step 16 — Frontend: Company Setup

**Goal:** Build the company creation wizard and settings pages.

### Mini-tasks

16.1. **Company creation wizard** (first-time user):

- Step 1: Basic info (legal name, trade name, legal form, UIN, fiscal number).
- Step 2: Address.
- Step 3: Activity codes.
- Step 4: Fiscal year start month.
- On submit: calls `POST /companies` which triggers full setup (tax rates, CoA, periods, defaults).

  16.2. **Company settings page** (`/settings`):

- Edit company info.
- Manage addresses.
- Manage activity codes.
- Manage users and roles.
- View/manage accounting periods (close/reopen).
- View/edit company account defaults (AR, Cash, Bank, VAT Payable, Sales Revenue mappings).

  16.3. Validation with `react-hook-form` + `zod`.

### Expected Output

- Company creation wizard + settings pages.

### Dependencies

Step 5, 6, 8 (backend APIs), Step 15 (frontend shell).

### Definition of Done

- New user can create a company through the wizard, which seeds all defaults.
- Settings pages allow editing all company configuration.
- Account defaults can be remapped.

---

## Step 17 — Frontend: Contacts + Catalog + Tax + Chart of Accounts

**Goal:** Build list and form pages for contacts, products/services, tax rates, and chart of accounts.

### Mini-tasks

17.1. **Contacts page** (`/contacts`):

- DataTable. Filter tabs: All / Customers / Vendors.
- Search by name.
- Create/edit form enforces at-least-one-flag rule.
- Deactivation via toggle.

  17.2. **Products & Services page** (`/products-services`):

- DataTable. Filter: Products / Services / All.
- Create/edit form with account and tax rate dropdowns.

  17.3. **Tax Rates page** (tab within settings or standalone):

- List, edit, deactivate.

  17.4. **Chart of Accounts page** (`/chart-of-accounts`):

- Flat list and tree view.
- Create/edit account form.
- System accounts visually indicated, non-deletable.
- Filter by account type.

### Expected Output

- Four CRUD pages.

### Dependencies

Step 7, 8, 9 (backend APIs), Step 15 (frontend shell).

### Definition of Done

- All four pages functional with filtering, search, create, edit.
- Contact creation rejects both-flags-false.
- All forms validate input.

---

## Step 18 — Frontend: Invoicing

**Goal:** Build the invoice list, create/edit form, issue action, and invoice detail view.

### Mini-tasks

18.1. **Invoice list** (`/invoices`):

- DataTable: invoice number (or "Draft" label if null), customer, date, due date, total, status, balance due.
- Filter by status. Search by number or customer name.

  18.2. **Create invoice** (`/invoices/new`):

- Header: select customer, issue date, due date, notes.
- Line items: product/service selector, quantity, unit price, discount, tax rate, line total.
- Live calculation: subtotal, tax, total.
- "Save as Draft" and "Save & Issue" buttons.

  18.3. **Edit invoice** (`/invoices/:id/edit`):

- Same form, pre-filled. Only for DRAFT invoices.

  18.4. **Invoice detail** (`/invoices/:id`):

- Read-only view of header + lines + totals.
- Status badge. Shows invoice number (once issued).
- Action buttons by status:
  - DRAFT: Edit, Issue, Delete.
  - ISSUED: Receive Payment, Void.
  - PAID: View only.
  - VOID: View only. Shows link to reversal journal entry.
- Linked journal entries (original + reversal if voided).
- Payment history (allocations).

  18.5. **Print-friendly invoice detail view**:

- A CSS `@media print` styled version of the invoice detail page.
- Shows: company legal name, address, UIN, fiscal number, customer details, line items, totals.
- Designed for browser print (Ctrl+P).
- No PDF generation in MVP.
- **Needs accountant/legal validation**: confirm required legal fields on a Kosovo sales invoice.

### Expected Output

- Invoice list, create, edit, detail, print-friendly view.

### Dependencies

Step 11 (invoices API), Step 7 (contacts), Step 9 (catalog), Step 15 (frontend shell).

### Definition of Done

- Create draft → save (no number shown).
- Issue → number assigned, visible. Journal entry linked.
- Void → reversal linked, status updated.
- Print-friendly view renders with legal details.
- Cannot edit/delete issued invoice.
- Live calculations accurate.

---

## Step 19 — Frontend: Payments

**Goal:** Build the payment recording UI with full allocation.

### Mini-tasks

19.1. **Payments list** (`/payments`):

- DataTable: date, contact, amount, method, status.

  19.2. **Receive Payment** (`/payments/new`):

- Select customer (or pre-filled from invoice detail).
- Payment date, method, reference, amount.
- Allocation section: shows customer's outstanding invoices. User allocates amount per invoice.
- Live validation: total allocations must equal payment amount exactly.
- "Record Payment" button.

  19.3. **Payment detail** (`/payments/:id`):

- Read-only view. Allocations with linked invoices.
- Linked journal entries (original + reversal if voided).
- Void button.

### Expected Output

- Payment list, create, detail pages.

### Dependencies

Step 13 (payments API), Step 18 (invoice references).

### Definition of Done

- Record fully-allocated payment → invoice statuses update.
- Cannot submit unless allocations == total.
- Void → allocations reversed, invoices restored.

---

## Step 20 — Frontend: Journal Entries

**Goal:** Build the manual journal entry UI.

### Mini-tasks

20.1. **Journal entries list** (`/journal-entries`):

- DataTable: entry number (or "Draft" if null), date, memo, source, status, total debit.
- Filter by status, source type, date range.
- "Reversed" indicator on entries that have `reversed_by_entry_id`.

  20.2. **Create/edit journal entry** (`/journal-entries/new`):

- Header: entry date, memo.
- Lines: account dropdown, description, debit, credit.
- Running total: sum debits, sum credits, difference highlighted in red when non-zero.
- "Save as Draft" / "Save & Post" buttons.

  20.3. **Journal entry detail** (`/journal-entries/:id`):

- Read-only for posted entries.
- Source document link (invoice / payment).
- If reversed: shows link to reversal entry and "Reversed" badge.
- Void action (only for manual, non-reversed entries).

### Expected Output

- Journal entry list, create, detail pages.

### Dependencies

Step 12 (journal entries API), Step 8 (accounts).

### Definition of Done

- Create draft → no entry_number.
- Post → entry_number assigned. Balance check enforced visually and at API.
- Reversed entries show indicator and link.
- System entries show source link, void blocked.

---

## Step 21 — Frontend: Reports

**Goal:** Build the five financial report pages.

### Mini-tasks

21.1. Report index page (`/reports`) with links.

21.2. **Trial Balance**: date range/period selector, account table with debit/credit/net, footer totals.

21.3. **General Ledger**: account + date range selectors, transaction table with running balance, pagination.

21.4. **Profit & Loss**: date range, revenue section, expense section, net income.

21.5. **Balance Sheet**: as-of date, assets/liabilities/equity sections, equation check.

21.6. **AR Aging**: as-of date, customer-grouped aging buckets.

21.7. Dense, accountant-friendly styling: right-aligned numbers, clear totals, EUR formatting.

### Expected Output

- Five report pages.

### Dependencies

Step 14 (reports API).

### Definition of Done

- All reports render correctly.
- Reversed entries are transparently included (their net effect is zero).
- Numbers formatted as EUR.
- Layout is dense and business-oriented.

---

## Step 22 — Frontend: Audit Log

**Goal:** Build the audit log viewer.

### Mini-tasks

22.1. **Audit log page** (`/audit-log`):

- DataTable: timestamp, user, entity type, entity ID, action.
- Expandable row: before/after JSON.
- Filters: entity type, action, user, date range.
- Pagination.

  22.2. Read-only.

### Expected Output

- Audit log page.

### Dependencies

Step 10 (audit API).

### Definition of Done

- Displays critical action entries.
- Filters work. Before/after readable. Read-only.

---

## Step 23 — End-to-End Testing & Polish

**Goal:** Verify the full MVP workflow end-to-end, fix bugs, polish UI.

### Mini-tasks

23.1. **End-to-end walkthrough**:

1. Register → create company → verify defaults seeded (CoA, tax rates, periods, account defaults).
2. Add customer contacts.
3. Add products/services.
4. Review chart of accounts + tax rates + account defaults.
5. Create draft invoice → no number → add lines → Issue → number assigned → journal entry posted.
6. Record fully-allocated payment → invoice PAID → journal entry posted.
7. Void invoice (on a different, unpaid invoice) → reversal entry created, original entry still POSTED.
8. Create manual journal entry → post → entry number assigned.
9. Void manual journal entry → reversal created, original still POSTED, reversed indicator shown.
10. Trial Balance → balanced (including reversed entries netted out).
11. P&L → revenue/expenses correct.
12. Balance Sheet → A = L + E.
13. AR Aging → outstanding invoices bucketed correctly.
14. Audit log → all critical actions visible.
15. Permissions: viewer cannot create invoice; accountant can.
16. Company switching works.

23.2. **Fix bugs** found during walkthrough.

23.3. **UI polish**: loading states, error toasts, empty states, confirmation dialogs.

23.4. **Performance check**: reports < 2s for 500 journal entries, no N+1 queries.

23.5. **Security check**: auth enforced, company isolation verified, password hashing confirmed.

### Expected Output

- A polished, working MVP.

### Dependencies

All previous steps.

### Definition of Done

- Full vertical slice works end-to-end.
- Reversal-based voiding works correctly in reports.
- No critical bugs.
- Performance acceptable.

---

## Step 24 — Deployment Setup

**Goal:** CI/CD and production deployment.

### Mini-tasks

24.1. Dockerize both apps (multi-stage builds).
24.2. Production docker-compose or orchestration config.
24.3. CI pipeline (lint, type-check, test on push; build + deploy on merge to main).
24.4. Database migrations via `prisma migrate deploy`.
24.5. Environment configuration (DATABASE_URL, JWT_SECRET, etc. in env vars).
24.6. **Recommendation**: Start with EU cloud region. Migrate to Kosovo DC if required.

### Expected Output

- Dockerfiles, CI/CD config, production deployment.

### Dependencies

Step 23 (stable MVP).

### Definition of Done

- Both apps deploy and run. CI passes. Migrations run. App accessible.

---

## Dependency Graph

```
Step  1  Monorepo & Dev Environment
  │
Step  2  Prisma Schema (full MVP data model)
  │       + DocumentSequence, CompanyAccountDefaults
  │       + nullable invoice_number / entry_number
  │       + Contact CHECK constraint
  │       + JournalEntryStatus: DRAFT | POSTED only
  │
Step  3  Backend Foundation
  │       + DocumentSequenceService
  │       + explicit company-scoping pattern
  │
Step  4  Auth Module
  │
Step  5  Companies Module
  │       (creates company + user access + document sequences)
  │       (does NOT seed CoA/tax/periods yet — deferred to Step 8)
  │
Step  6  Permissions Module
  │
  ├─────── Step  7   Contacts (with at-least-one-flag validation)
  ├─────── Step  8   Tax + CoA + Periods + Account Defaults + CompanySetupService
  │           │       (wires into company creation: seeds all defaults)
  │        Step  9   Catalog
  │           │
  ├─────── Step 10   Audit (explicit logging, cross-cutting pass on 5-9)
  │
Step 11  Sales Invoicing
  │       (number on issue, reversal-based void, uses account defaults)
  │
Step 12  Manual Journal Entries
  │       (number on post, reversal-based void)
  │
Step 13  Payments
  │       (full allocation required, reversal-based void, uses account defaults)
  │
Step 14  Reports
  │       (query POSTED entries only — reversals net to zero automatically)
  │
  ══════════════════════════════════════════
  │         BACKEND COMPLETE
  ══════════════════════════════════════════
  │
Step 15  Frontend Foundation
Step 16  Frontend: Company Setup (includes account defaults UI)
Step 17  Frontend: Contacts + Catalog + Tax + CoA
Step 18  Frontend: Invoicing (print-friendly view, no PDF)
Step 19  Frontend: Payments (full allocation UI)
Step 20  Frontend: Journal Entries (draft = no number, reversed indicator)
Step 21  Frontend: Reports
Step 22  Frontend: Audit Log
  │
Step 23  E2E Testing & Polish
Step 24  Deployment
```

---

## Summary of Schema Changes from v0.1

| Table                             | Change                                                                                                   | Reason                                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **NEW: `DocumentSequence`**       | Per-company, per-document-type, per-fiscal-year counter table. `fiscal_year` is required (non-nullable). | Gap-free numbering assigned on issue/post. Required fiscal_year avoids nullable uniqueness problem in PostgreSQL.                |
| **NEW: `CompanyAccountDefaults`** | Maps account roles to company accounts                                                                   | Posting engine needs to know which accounts to debit/credit.                                                                     |
| **`Invoice`**                     | `invoice_number` now nullable                                                                            | Number assigned on issue, not on draft creation.                                                                                 |
| **`Invoice`**                     | Added `voided_journal_entry_id` (FK, nullable)                                                           | Links to the reversal journal entry when voided.                                                                                 |
| **`JournalEntry`**                | `entry_number` now nullable                                                                              | Number assigned on post, not on draft creation.                                                                                  |
| **`JournalEntry`**                | Status enum: `DRAFT \| POSTED` only (removed VOID)                                                       | Reversal-based voiding: original stays POSTED, reversal entry nets it out.                                                       |
| **`JournalEntry`**                | Added `reversed_by_entry_id` (self-FK, nullable)                                                         | Bidirectional link between original and reversal entry.                                                                          |
| **`JournalEntry`**                | Removed `voided_at`, `voided_by`                                                                         | No VOID status, so no voiding metadata needed.                                                                                   |
| **`Payment`**                     | Removed `unallocated_amount`                                                                             | MVP requires full allocation; no partial/on-account payments.                                                                    |
| **`Payment`**                     | Status enum: `RECORDED \| VOID` only (removed ALLOCATED)                                                 | With full allocation, there's no separate "allocated" transition.                                                                |
| **`Payment`**                     | Added `voided_journal_entry_id` (FK, nullable)                                                           | Links to the reversal journal entry when voided.                                                                                 |
| **`Payment`**                     | `PaymentMethod` enum: `CASH \| BANK_TRANSFER` only (removed OTHER)                                       | Every method must map to a known account. OTHER had a silent CASH fallback. Post-MVP: add methods with explicit account mapping. |
| **`PaymentAllocation`**           | Added `is_voided` (Boolean, default false) and `voided_at` (nullable)                                    | Allocations are soft-voided on payment void, not deleted. Preserves audit history.                                               |
| **`Contact`**                     | Added CHECK constraint: `is_customer OR is_vendor`                                                       | Enforced at DB level, not just application.                                                                                      |

---

## Items Flagged for Accountant Validation

| #    | Item                                                                                          | Step  | Why                                                                   |
| ---- | --------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------- |
| AV-1 | Kosovo VAT rates: 18% standard, 8% reduced, 0% exempt — correct and complete?                 | 2, 8A | Tax seed data must be accurate.                                       |
| AV-2 | Default chart of accounts numbering and hierarchy for Kosovo SMEs.                            | 2, 8B | Incorrect CoA template wastes user time.                              |
| AV-3 | Tax-exclusive vs tax-inclusive: which is standard for Kosovo SME invoicing?                   | 8A    | Affects line item calculation defaults.                               |
| AV-4 | Invoice numbering format: any Kosovo regulatory requirements on format/prefix/annual reset?   | 11    | Must be gap-free. Format may be regulated.                            |
| AV-5 | Required legal fields on a Kosovo sales invoice.                                              | 18    | Print view must be legally compliant.                                 |
| AV-6 | Should MVP support unallocated payments (customer advances)? If yes, which liability account? | 13    | MVP currently requires full allocation. Post-MVP extension if needed. |

---

## Post-MVP Roadmap — toward QuickBooks-style breadth (Steps 25+)

The MVP (Steps 1–24) is complete and deployed (Vercel + Render + Neon). The
following phases extend LiFa into a fuller small-business product. Each phase =
backend module + Prisma migration + frontend + i18n (sq/en) + verification,
shipped through the existing pipeline.

- **Step 25 — Phase 1: Purchases / Accounts Payable** ✅ _Done._
  Vendor `Bill` (DRAFT → OPEN → PARTIALLY_PAID → PAID → VOID), posting that
  DEBITs expense + input VAT (`VAT Receivable`) and CREDITs `Accounts Payable`,
  bill payments via `PaymentType.MADE` (reusing the Payments module with
  `PaymentAllocation.billId`), and an **AP aging** report. New account roles
  `ACCOUNTS_PAYABLE` / `VAT_RECEIVABLE` / `EXPENSE` + default accounts
  `1400 VAT Receivable`, `5900 Other Expenses`. Module: `src/modules/purchases`.
- **Step 26 — Phase 2: Document delivery** — invoice & bill **PDF** + print +
  email; sent/viewed status.
- **Step 27 — Phase 3: Banking** — bank/cash accounts, **CSV statement import**,
  match-to-payment/bill suggestions, reconciliation, transfers.
- **Step 28 — Phase 4: VAT & fiscalization** — VAT return report (output − input
  VAT) and the live ATK `ATK_EFS` fiscalization adapter (see `FISCALIZATION.md`).
- **Step 29 — Phase 5: Sales/purchase extras** — estimates/quotes → invoice,
  credit notes / vendor credits, recurring invoices, customer statements.
- **Step 30 — Phase 6: Inventory + advanced** — stock qty + COGS, multi-currency,
  budgets, classes/locations, cash-flow & sales-by-item/customer reports.

---

_End of implementation plan._
