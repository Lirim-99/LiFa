# LiFa — Product Brief

**Kosovo-First Accounting SaaS for SMEs**

Version: 0.2 | Date: 2026-03-28 | Status: Draft

---

## 1. Vision

LiFa is a cloud-native, Kosovo-first accounting platform built for small and medium enterprises. It starts with the smallest real accounting workflow that every Kosovo company needs — double-entry bookkeeping, sales invoicing, and financial reporting — then expands into purchase invoices, VAT returns, fiscalization, POS, inventory, and bank reconciliation.

Important product principle: do not start as a full ERP. Start with the first vertical slice that delivers real value — contacts, products, sales invoices, payments, journal posting, and financial reports.

---

## 2. Domain Modules

The system is decomposed into the following bounded contexts, each implemented as an internal module within a modular monolith. In product and domain language we use **company** (not "tenant") to refer to the business entity that scopes all data.

| #   | Module                    | Responsibility                                                                                                                                                             |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Auth**                  | User registration, login, JWT session management.                                                                                                                          |
| 2   | **Companies**             | Company CRUD, multi-company access, company switching. A user may belong to multiple companies; each company is an isolated accounting entity.                             |
| 3   | **Company Legal Profile** | MVP business/legal profile fields (see §3). Kept separate from operational accounting data so registry extensions can be added later without touching the accounting core. |
| 4   | **Contacts**              | Flexible contact model. A single contact record can act as customer, vendor, or both (see §2.4).                                                                           |
| 5   | **Catalog**               | Products and services with linked income/expense accounts and default tax rates.                                                                                           |
| 6   | **Tax**                   | Tax rate definitions: name, rate, calculation type (exclusive/inclusive), scope (sales/purchases/both).                                                                    |
| 7   | **Accounting**            | Chart of accounts, accounting periods, journal entries + lines, general ledger (derived view). This is the double-entry bookkeeping engine.                                |
| 8   | **Sales**                 | Sales invoices, invoice lines, invoice lifecycle (draft → issued → paid → void). Auto-generates journal entries on issue.                                                  |
| 9   | **Payments**              | Payment recording, allocation to invoices, invoice balance tracking. Auto-generates journal entries on recording.                                                          |
| 10  | **Reports**               | Read-only financial reports: trial balance, general ledger, profit & loss, balance sheet, AR aging.                                                                        |
| 11  | **Audit**                 | Append-only log of critical accounting and admin actions (see §2.8 for MVP scope).                                                                                         |
| 12  | **Permissions**           | Roles (owner, admin, accountant, viewer) and permission checks. Scoped per company.                                                                                        |

### 2.1 Auth

Users and sessions. Decoupled from company data — a user exists independently and is then granted access to one or more companies via the permissions/company-access model.

### 2.2 Companies

The company is the top-level data isolation boundary. Every business table carries a `company_id` foreign key. The companies module manages:

- Company record (the legal/business profile fields live here or in company-legal-profile).
- User-company access (which users can access which companies, with which role).
- Company switching (a user picks their active company; all API calls are scoped to it).

### 2.3 Company Legal Profile

**MVP scope** — the base business/legal fields that every Kosovo company needs for invoicing and basic identification:

| Field                     | Notes                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| `legal_name`              | Official registered name.                                             |
| `trade_name`              | DBA / marketing name. May equal legal name.                           |
| `legal_form`              | Enum: BI, OP, KO, SHPK, SHA, Foreign Branch, NGO, Other.              |
| `uin_nui`                 | ARBK unique identification number (9-digit).                          |
| `fiscal_number`           | TAK fiscal number.                                                    |
| `vat_number`              | VAT registration number (nullable — not all SMEs are VAT-registered). |
| `registration_date`       | Date of ARBK registration.                                            |
| `email`                   | Company email.                                                        |
| `phone`                   | Company phone.                                                        |
| `website`                 | Company website (nullable).                                           |
| `default_currency`        | Default `EUR`.                                                        |
| `fiscal_year_start_month` | 1–12, default 1 (January).                                            |

**MVP sub-entities:**

| Entity                    | Fields                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Company Address**       | `address_type` (registered / business / other), `country`, `municipality`, `city`, `street`, `postal_code`, `is_primary`. |
| **Company Activity Code** | `activity_type` (primary / secondary), `code` (NACE Rev. 2), `description`, `sort_order`.                                 |

**Post-MVP compliance/registry extensions** (not in MVP):

- Owners (name, personal ID, ownership %, nationality).
- Directors / authorized persons (name, personal ID, role/title).
- Branches (branch name, address, activity codes).
- Share capital details.
- Advanced ARBK registry filing data.

These are deferred because they are not required for the core accounting workflow. They become relevant when the product adds compliance filing, advanced company registry integration, or multi-branch support.

### 2.4 Contacts

The contact model is **flexible by design**. There is a single `contacts` table, not separate `customers` and `vendors` tables.

| Design decision                                             | Rationale                                                                                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single table with `is_customer` / `is_vendor` boolean flags | A real-world business partner may be both a customer and a vendor. Duplicating records across two tables creates data sync problems and confusing UX. |
| At least one flag must be true                              | A contact with neither flag set has no business purpose.                                                                                              |
| Filtering by role                                           | List endpoints accept a `type` filter (customer / vendor / all). The UI shows tabs or a dropdown.                                                     |

Contact fields (MVP): `display_name`, `legal_name`, `email`, `phone`, `tax_id`, `payment_terms_days`, `currency`, `country`, `municipality`, `city`, `street`, `postal_code`, `is_active`, `notes`.

### 2.5 Catalog (Products & Services)

Products and services that can be referenced on invoice lines. Each item links to an income account, an expense account, and a default tax rate — all optional, all overridable per invoice line.

### 2.6 Tax

Tax rate definitions. Seeded with Kosovo template rates on company creation:

- **Standard 18%** — **needs accountant validation**: confirm rate and label.
- **Reduced 8%** — **needs accountant validation**: confirm rate, label, and applicable goods/services.
- **Zero / Exempt 0%** — **needs accountant validation**: confirm whether zero-rate and exempt are treated as one rate or two.

Each company gets its own editable copy of the template rates. Company-level rates can be added, edited, or deactivated.

### 2.7 Accounting

The double-entry bookkeeping engine. Three sub-areas:

**Chart of Accounts (CoA)**

- Account: code, name, type (Asset / Liability / Equity / Revenue / Expense), subtype, normal balance (debit / credit), parent account (nullable, for hierarchy), `is_postable`, `is_system`, `is_active`.
- On company creation, a default chart of accounts is seeded. **Needs accountant validation**: the exact Kosovo-standard CoA numbering scheme, hierarchy, and account names must be confirmed by a local accountant. The implementation will ship with a reasonable IFRS-for-SMEs-aligned placeholder that is fully editable.
- System accounts (AR, AP, Cash, Bank, Sales Revenue, VAT Payable, Retained Earnings) are marked `is_system = true` and cannot be deleted.

**Accounting Periods**

- Fiscal year + 12 monthly periods, auto-generated based on `fiscal_year_start_month`.
- Status: open (allows posting) or closed (blocks all posting and mutation).
- Closing a period is guarded: no draft journal entries may remain in the period.

**Journal Entries**

- Header: entry number (null while draft, assigned on post), date, period (assigned on post), source document reference, memo, status (draft / posted — no void status).
- Lines: account, debit amount, credit amount, description, currency, exchange rate.
- Rules:
  - Total debits must equal total credits before posting.
  - Cannot post into a closed period.
  - Posted entries are immutable — no edits, no deletes, no status changes.
  - Corrections via reversal entry (a new POSTED entry with opposite lines) + new correcting entry. The original entry stays POSTED forever; a reversed entry is identified by having `reversed_by_entry_id IS NOT NULL`.
  - Draft entries may be freely edited or deleted.

**General Ledger**

- A derived, read-only view over posted journal entry lines. Not a separate table.

### 2.8 Sales

**MVP covers sales invoices only. Purchase invoices are post-MVP.**

Sales invoice lifecycle:

| Status           | Behavior                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft`          | Editable. Lines can be added, changed, removed. No accounting effect.                                                                                                                                                |
| `issued`         | Locked. A journal entry is created and posted in the same database transaction (debit AR, credit Revenue, credit VAT Payable if applicable). If the journal entry fails, the invoice stays draft — no partial state. |
| `partially_paid` | At least one payment allocated, but `balance_due > 0`.                                                                                                                                                               |
| `paid`           | `balance_due == 0`.                                                                                                                                                                                                  |
| `void`           | Reversed. A reversal journal entry is created (POSTED; the original journal entry also stays POSTED — the reversal nets it out). Only possible if no payments are allocated.                                         |

Invoice numbering: auto-generated, sequential, per-company. Assigned only at the moment of issue (not on draft creation) to avoid wasting numbers on abandoned drafts. Draft invoices carry no official number. Managed via a `DocumentSequence` counter table with row-level locking. **Needs accountant/legal validation**: confirm whether Kosovo regulations prescribe a specific invoice number format or prefix.

### 2.9 Payments

Payment recording and allocation to sales invoices (MVP). Payment for purchase invoices is post-MVP.

**MVP rule: full allocation required.** Every payment must be fully allocated to one or more invoices at creation time. The sum of all allocation amounts must equal the payment total. There is no concept of unallocated / on-account receipts in MVP. **Needs accountant validation**: if customer advances/deposits are common, a partial-allocation model with a Customer Advances liability account can be added post-MVP.

Flow (all within a single database transaction):

1. Create payment record (status = RECORDED).
2. Validate: sum of allocations == payment total.
3. Create allocation(s) linking payment to invoice(s).
4. Update each invoice's `paid_amount` and `balance_due`; transition status to `partially_paid` or `paid`.
5. Look up company account defaults for the debit account (Cash or Bank based on payment method) and credit account (Accounts Receivable).
6. Create and post a journal entry (debit Cash/Bank, credit Accounts Receivable).
7. If any step fails, the entire transaction rolls back.

Void: creates a reversal journal entry (both original and reversal stay POSTED), soft-voids allocations (marked `is_voided = true`, not deleted — preserves audit history), restores invoice balances.

### 2.10 Reports

All reports are read-only, derived from posted journal entry lines and invoice data. No writes.

| Report             | Input                | Output                                                                                         |
| ------------------ | -------------------- | ---------------------------------------------------------------------------------------------- |
| **Trial Balance**  | Date range or period | Per-account debit/credit totals. Must balance.                                                 |
| **General Ledger** | Account + date range | Chronological list of posted journal lines with running balance.                               |
| **Profit & Loss**  | Date range           | Revenue less expenses. Grouped by account.                                                     |
| **Balance Sheet**  | As-of date           | Assets, Liabilities, Equity. Must satisfy A = L + E.                                           |
| **AR Aging**       | As-of date           | Outstanding invoice balances bucketed by age (current, 31–60, 61–90, 91+), grouped by contact. |

AP Aging is deferred to post-MVP (requires purchase invoices).

### 2.11 Audit

**MVP audit scope is limited to critical accounting and admin actions only** — not "every write across all modules."

| Category              | Audited actions                                    |
| --------------------- | -------------------------------------------------- |
| **Company setup**     | Company create, update.                            |
| **Chart of accounts** | Account create, update, deactivate.                |
| **Invoices**          | Create, issue, void.                               |
| **Payments**          | Create, allocate, void.                            |
| **Journal entries**   | Create, post, void.                                |
| **Access / roles**    | User access granted, role changed, access revoked. |

Each audit entry: `company_id`, `user_id`, `entity_type`, `entity_id`, `action`, `before_json` (nullable), `after_json` (nullable), `occurred_at`, `ip_address`.

Append-only. No update or delete operations on audit log records.

### 2.12 Permissions

Hardcoded role-based access control for MVP. Four roles:

| Role           | Scope                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **owner**      | Full access. Can manage company settings, users, roles.                                                                                               |
| **admin**      | Full access except transferring ownership.                                                                                                            |
| **accountant** | Can manage contacts, catalog, tax, invoices, payments, journal entries. Can view reports and audit log. Cannot manage company settings or user roles. |
| **viewer**     | Read-only access to reports. Cannot create or modify any data.                                                                                        |

Custom/granular permissions are post-MVP.

---

## 3. MVP Scope (v1.0)

### Included in MVP

| #   | Feature                                                                                      | Module                |
| --- | -------------------------------------------------------------------------------------------- | --------------------- |
| 1   | User registration, login, JWT session                                                        | Auth                  |
| 2   | Create / switch between companies                                                            | Companies             |
| 3   | Company legal/business profile (base fields, addresses, activity codes — see §2.3 MVP scope) | Company Legal Profile |
| 4   | Roles and permissions (owner, admin, accountant, viewer)                                     | Permissions           |
| 5   | Company user access management (invite, change role, remove)                                 | Permissions           |
| 6   | Flexible contact management (customer, vendor, or both)                                      | Contacts              |
| 7   | Product / service catalog                                                                    | Catalog               |
| 8   | Tax rate management (seeded with Kosovo template rates)                                      | Tax                   |
| 9   | Chart of accounts (seeded with default CoA, fully editable)                                  | Accounting            |
| 10  | Fiscal year and monthly period management (open / close)                                     | Accounting            |
| 11  | Manual journal entries (create, post, void)                                                  | Accounting            |
| 12  | Balance validation (debits = credits) enforced on post                                       | Accounting            |
| 13  | Sales invoices with auto-numbering (draft → issued → paid → void)                            | Sales                 |
| 14  | Automatic journal entry generation on invoice issue                                          | Sales + Accounting    |
| 15  | Payment recording and allocation to sales invoices                                           | Payments              |
| 16  | Automatic journal entry generation on payment recording                                      | Payments + Accounting |
| 17  | Trial balance report                                                                         | Reports               |
| 18  | General ledger report                                                                        | Reports               |
| 19  | Profit & loss report                                                                         | Reports               |
| 20  | Balance sheet report                                                                         | Reports               |
| 21  | AR aging report                                                                              | Reports               |
| 22  | Audit log for critical actions (see §2.11 scope)                                             | Audit                 |
| 23  | Company-level settings (fiscal year start month, default currency)                           | Companies             |

### MVP Constraints

- **Single currency**: EUR only. `currency` and `exchange_rate` fields exist in the schema (defaulting to EUR / 1.0) to prepare for multi-currency without migration, but multi-currency logic is not built.
- **Sales invoices only**: No purchase invoice entry. Vendor payments and AP-side transactions can be handled via manual journal entries until purchase invoices are added post-MVP.
- **No purchase invoices, no AP aging**: Both deferred to post-MVP.
- **No credit notes**: Invoice corrections in MVP are handled via void + re-issue. Formal credit notes are post-MVP.
- **No invoice PDF generation**: Deferred to post-MVP. MVP shows a print-friendly invoice detail view in the browser.
- **No advanced company registry fields**: Owners, directors, branches, share capital are post-MVP.
- **No public API**: No third-party API access.
- **No mobile app**: Responsive web only.
- **No automated bank feeds or reconciliation**.

---

## 4. Non-MVP Scope (Post-v1.0 Roadmap)

Ordered roughly by expected priority and dependency.

| Phase    | Feature                             | Notes                                                                                                        |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **v1.1** | **Purchase invoices + AP workflow** | Purchase invoice entry, AP journal generation, AP aging report.                                              |
| **v1.1** | **Credit notes**                    | Formal credit note linked to original invoice, with journal reversal.                                        |
| **v1.1** | **Invoice PDF generation**          | Server-side or client-side PDF with legal fields. **Needs accountant/legal validation** for required fields. |
| **v1.2** | **Company registry extensions**     | Owners, directors, branches, share capital. Full ARBK alignment.                                             |
| **v1.2** | **Multi-currency**                  | Non-EUR transactions, exchange rate tracking, unrealized gain/loss.                                          |
| **v1.3** | **VAT module**                      | Kosovo VAT return preparation per TAK rules. Input/output VAT, VAT periods, VAT report.                      |
| **v1.3** | **Fiscalization**                   | Integration with Kosovo fiscal receipt system (ATK devices / e-fiscalization).                               |
| **v1.4** | **Bank reconciliation**             | Bank statement import (CSV/MT940). Matching engine. Future: Open Banking.                                    |
| **v1.4** | **Recurring invoices**              | Template-based auto-generation on schedule.                                                                  |
| **v2.0** | **POS module**                      | Point-of-sale. Ties into fiscalization, inventory, payments.                                                 |
| **v2.0** | **Inventory management**            | Stock tracking, FIFO/weighted-average costing, purchase orders.                                              |
| **v2.x** | **Payroll**                         | Kosovo-specific: pension contributions, income tax, health insurance.                                        |
| **v2.x** | **Public API**                      | RESTful API for third-party integrations.                                                                    |
| **v3.x** | **Multi-country**                   | Albania, North Macedonia, Serbia. Locale-specific legal structures, CoA templates, tax regimes.              |

---

## 5. Risks

| #   | Risk                                                                                                                | Likelihood | Impact   | Mitigation                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Kosovo tax regulation changes** — TAK or ARBK alter registration rules, VAT rates, or fiscalization requirements. | Medium     | High     | Tax rates and legal-entity fields are configurable data, not hardcoded logic. Monitor TAK/ARBK announcements.                                                                                      |
| R2  | **Fiscalization mandate uncertainty** — Kosovo's e-fiscalization timeline and technical spec may shift.             | High       | Medium   | Defer implementation. Ensure the invoice schema has extensibility points (nullable `fiscalization_status`, signing hook) but do not build the integration until the spec is stable.                |
| R3  | **Scope creep into ERP** — Pressure to add inventory, payroll, POS before core accounting is solid.                 | High       | High     | Enforce modular boundaries. MVP ships accounting + sales invoicing only. Each post-MVP module requires its own brief and sign-off.                                                                 |
| R4  | **Data integrity bugs in double-entry** — Incorrect journal entries corrupt the ledger.                             | Low        | Critical | Enforce balanced entries at database level (CHECK constraint or application-layer guard). Immutable posted entries. Comprehensive test coverage of the journal engine.                             |
| R5  | **Cross-company data leakage** — One company sees another company's data.                                           | Low        | Critical | `company_id` on every business table. Enforced explicitly in every service method (companyId as required parameter in every query). PostgreSQL RLS as defense-in-depth. Automated isolation tests. |
| R6  | **Performance at scale** — Large companies with 100k+ journal lines degrade report speed.                           | Medium     | Medium   | Index `journal_entry_lines` on `(company_id, account_id, entry_date)`. Pagination everywhere. Monitor query plans from launch.                                                                     |
| R7  | **Low adoption / market fit** — Kosovo SMEs resist switching from spreadsheets.                                     | Medium     | High     | Validate with 5–10 pilot SMEs. Offer spreadsheet import. Free tier for micro-businesses.                                                                                                           |
| R8  | **Small-team bottleneck** — Too few engineers to deliver and support.                                               | Medium     | Medium   | Modular monolith limits complexity. Prioritize ruthlessly. Automate CI/CD and testing from week one.                                                                                               |
| R9  | **Incorrect default CoA or tax templates** — Shipped defaults don't match Kosovo accounting norms.                  | Medium     | Medium   | Mark all Kosovo-specific defaults as "needs accountant validation". Make every default fully editable by the user. Never block workflows if the user customizes away from defaults.                |

---

## 6. Architecture Decision Summary

### ADR-01: Modular Monolith over Microservices

**Decision:** Start as a modular monolith deployed as a single NestJS application. Each domain module is a NestJS module with its own folder and service layer. Modules communicate via direct function calls — not HTTP or message queues.

**Rationale:**

- Small team. Microservices add deployment orchestration, network latency, and distributed transaction problems with zero benefit at this stage.
- Module boundaries are enforced by conventions (module A imports module B's service interface, never its repository directly).
- Any module can be extracted to a separate service later if it needs independent scaling.

### ADR-02: Next.js Frontend + NestJS Backend (Separate Deployments)

**Decision:** The frontend is a standalone Next.js (App Router) application. The backend is a standalone NestJS REST API. They communicate via HTTP/JSON.

**Rationale:**

- Separation of concerns. Frontend can deploy to Vercel/CDN; backend runs in a container.
- Next.js provides SSR for public pages and client-side interactivity for the app shell.
- NestJS provides a structured, TypeScript-native backend with DI, guards, interceptors, and a module system that maps cleanly to the domain.

### ADR-03: PostgreSQL + Prisma ORM

**Decision:** PostgreSQL as the sole data store. Prisma as the ORM and migration tool.

**Rationale:**

- PostgreSQL is battle-tested for financial data: CHECK constraints, advisory locks, JSONB for audit payloads.
- Prisma provides type-safe database access, declarative schema, and auto-generated migrations.
- Single database with `company_id` discriminator column (not schema-per-company) to simplify migrations and connection pooling.

### ADR-04: Company-Scoped Data Isolation

**Decision:** Every business table includes a `company_id` foreign key. All queries are scoped by company.

**Rationale:**

- Simplest model for early stage. One database, one schema, one connection pool.
- Enforced explicitly in every service method: `companyId` is a required parameter, included in every Prisma `where` clause. This makes scoping visible, testable, and auditable at the code level.
- PostgreSQL Row-Level Security (RLS) is a recommended defense-in-depth layer for production but is not the primary isolation mechanism.
- If a company later needs physical isolation (regulatory or scale reasons), it can be migrated to a dedicated schema or database.

### ADR-05: EUR as Base Currency (Single-Currency MVP)

**Decision:** All monetary values stored in EUR with `Decimal(19,4)` precision. Multi-currency deferred to post-MVP.

**Rationale:**

- EUR is the legal tender of Kosovo. The vast majority of SME transactions are EUR-denominated.
- Multi-currency adds exchange rate tables, unrealized gain/loss calculations, and revaluation — significant complexity.
- Schema includes `currency` and `exchange_rate` fields from day one (defaulting to EUR / 1.0) to enable multi-currency later without schema migration.

### ADR-06: Immutable Ledger — Reversal-Based Corrections

**Decision:** Posted journal entries are immutable. Their status is never changed after posting. Corrections are made by creating a new **reversal entry** (with equal-and-opposite lines) that is also `POSTED`. The original and reversal entries are linked bidirectionally (`reversal_of_entry_id` / `reversed_by_entry_id`).

**Journal entry status enum:** `DRAFT` | `POSTED`. There is no `VOID` status on journal entries.

**Rationale:**

- Standard accounting practice. Editing or status-mutating a posted entry destroys the audit trail.
- Financial reports query `WHERE status = 'POSTED'`. With reversal-based voiding, both the original and reversal entries are POSTED and their net effect is zero — reports remain mathematically correct without special-case status filtering.
- Draft entries may be freely edited or deleted. Once posted, the entry is locked forever.

### ADR-07: Synchronous Core, Events for Side Effects Only

**Decision:** Core accounting flows (invoice issuing + journal posting, payment recording + allocation + journal posting) are synchronous and transactional — executed within a single database transaction. NestJS `EventEmitter2` is used only for non-critical side effects: notifications, activity feed, analytics, read-model refresh.

**Rationale:**

- Financial data integrity requires that the source-of-truth ledger is never written via async/eventual-consistency paths. If the journal entry fails, the invoice must not become issued.
- Events are useful for decoupling truly optional work (e.g., sending an email notification after an invoice is issued), but must never be on the critical path of a financial transaction.
- This keeps transactional guarantees simple and debuggable.

### ADR-08: Audit Log — Append-Only, Explicit Logging, Critical Actions Only (MVP)

**Decision:** A dedicated `audit_logs` table captures critical accounting and admin actions. Fields: `id`, `company_id`, `user_id`, `entity_type`, `entity_id`, `action`, `before_json` (JSONB, nullable), `after_json` (JSONB, nullable), `occurred_at`, `ip_address`.

**MVP scope:** Company setup changes, CoA changes, invoice create/issue/void, payment create/allocate/void, journal create/post/void, role/access changes. Not every write across every table.

**Implementation:** Audit entries are written via explicit calls to `AuditService.log()` within the service methods that perform critical actions — not via a generic NestJS interceptor. Explicit calls are simpler, more reliable, and easier to test than inferring audit context from request/response shapes.

**Rationale:**

- Full audit-everything is expensive to build and store. MVP focuses on actions with accounting or security significance.
- Append-only: no updates, no deletes. Enforced at the application layer.
- Scope can be expanded post-MVP as needed.

### ADR-09: Document Numbering — Assign on Issue/Post, Not on Draft

**Decision:** Official document numbers (invoice numbers, journal entry numbers) are assigned only at the moment of issuance or posting — never when a draft is created. Draft documents carry no official number (the field is `NULL`), identified only by their internal UUID. Numbers are managed by a `DocumentSequence` table with per-company, per-document-type, per-fiscal-year counters (`fiscal_year` is required, non-nullable), using `SELECT ... FOR UPDATE` for gap-free sequencing.

**Needs accountant/legal validation:** Confirm whether Kosovo regulations prescribe a specific invoice number format, prefix, or reset policy (e.g., annual reset). Until validated, the implementation will use a simple `INV-{YYYY}-{NNNNN}` format as a safe default.

**Rationale:**

- Assigning numbers on draft creation wastes sequence numbers when drafts are abandoned or deleted, creating gaps in the official sequence.
- Gap-free sequencing is a common requirement for tax compliance.
- Database-level row locking prevents duplicate numbers under concurrency.

### ADR-10: Monorepo Structure

**Decision:** A single Git repository containing `frontend/` (Next.js), `backend/` (NestJS), and `packages/shared/` (shared TypeScript types), managed with pnpm workspaces.

**Rationale:**

- Simplifies code sharing (types, enums, validation schemas).
- Single CI/CD pipeline.
- Appropriate for a small team. Can be split later if needed.

---

## 7. High-Level Folder Structure

```
LiFa/
├── frontend/                       # Next.js application
│   ├── src/
│   │   ├── app/                    # App Router pages
│   │   ├── components/             # Shared UI components
│   │   ├── lib/                    # API client, utilities
│   │   └── types/                  # Shared TypeScript types
│   ├── public/
│   ├── next.config.js
│   └── package.json
│
├── backend/                        # NestJS application
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/               # Authentication, JWT, session
│   │   │   ├── companies/          # Company CRUD, user-company access
│   │   │   ├── company-legal-profile/  # Addresses, activity codes
│   │   │   ├── contacts/           # Flexible contact model
│   │   │   ├── catalog/            # Products & services
│   │   │   ├── tax/                # Tax rates
│   │   │   ├── accounting/         # CoA, periods, journal entries
│   │   │   ├── sales/              # Sales invoices
│   │   │   ├── payments/           # Payments, allocations
│   │   │   ├── reports/            # Read-only report generators
│   │   │   ├── audit/              # Audit log
│   │   │   └── permissions/        # Roles, guards, access control
│   │   ├── common/                 # Guards, interceptors, filters, pipes, decorators
│   │   ├── prisma/                 # Prisma schema, migrations, seed
│   │   └── main.ts
│   ├── test/
│   └── package.json
│
├── packages/                       # Shared code
│   └── shared/
│       ├── src/                    # Enums, types, constants
│       └── package.json
│
├── docker-compose.yml              # Local dev: PostgreSQL
├── PRODUCT_BRIEF.md                # This document
├── IMPLEMENTATION_PLAN.md          # Step-by-step build plan
└── package.json                    # Workspace root (pnpm)
```

---

## 8. Entity Relationship Overview (MVP)

```
Company 1──* User                   (via UserCompanyAccess, which also carries Role)
Company 1──* CompanyAddress
Company 1──* CompanyActivityCode
Company 1──* CompanyAccountDefaults  (maps account roles to company accounts)
Company 1──* DocumentSequence        (per-document-type, per-fiscal-year counters)

Company 1──* Contact                 (is_customer / is_vendor flags; CHECK: at least one true)
Company 1──* ProductService
Company 1──* TaxRate
Company 1──* Account                 (Chart of Accounts, self-referencing parent)

Company 1──* AccountingPeriod
Company 1──* JournalEntry 1──* JournalEntryLine
Company 1──* Invoice     1──* InvoiceLine
Company 1──* Payment     1──* PaymentAllocation

Company 1──* AuditLog

CompanyAccountDefaults ──1 Account

JournalEntryLine ──1 Account
JournalEntry     ──1 AccountingPeriod         (set on post)
JournalEntry     ──? JournalEntry             (reversal_of_entry_id: reversal → original)
JournalEntry     ──? JournalEntry             (reversed_by_entry_id: original → reversal)

Invoice     ──1 Contact
Invoice     ──? JournalEntry                  (posted_journal_entry_id: set on issue)
Invoice     ──? JournalEntry                  (voided_journal_entry_id: set on void, points to reversal)
InvoiceLine ──? ProductService                (nullable)
InvoiceLine ──? TaxRate                       (nullable)
InvoiceLine ──? Account                       (income account override, nullable)

Payment     ──1 Contact
Payment     ──? JournalEntry                  (posted_journal_entry_id: set on recording)
Payment     ──? JournalEntry                  (voided_journal_entry_id: set on void, points to reversal)
PaymentAllocation ──1 Invoice
PaymentAllocation ──1 Payment

JournalEntryLine ──? Contact                  (nullable, for sub-ledger tracking)

Note: Invoice.invoice_number is NULL while draft, assigned on issue.
Note: JournalEntry.entry_number is NULL while draft, assigned on post.
Note: JournalEntry.status is DRAFT or POSTED only (no VOID status).
```

---

## 9. Items Needing External Validation

| #   | Item                                                                                                                              | Type                              | Why                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| V1  | Kosovo standard chart of accounts numbering, hierarchy, and account names.                                                        | Needs accountant validation       | Incorrect CoA defaults waste setup time and erode trust. |
| V2  | Kosovo VAT rates: 18% standard, 8% reduced, 0% exempt — are these correct and complete? Are zero-rate and exempt one rate or two? | Needs accountant validation       | Tax seed data must be accurate.                          |
| V3  | Tax-exclusive vs tax-inclusive: which is standard for Kosovo SME invoicing?                                                       | Needs accountant validation       | Affects default calculation type on invoice lines.       |
| V4  | Invoice numbering format: does Kosovo law require a specific format, prefix, or annual reset?                                     | Needs accountant/legal validation | Must be gap-free. Format may be regulated.               |
| V5  | Required legal fields on a Kosovo sales invoice (beyond company name, fiscal number, UIN, address).                               | Needs accountant/legal validation | Future PDF output must be compliant.                     |
| V6  | Payment journal entry: should the full payment amount hit AR immediately, or only allocated portions?                             | Needs accountant validation       | Affects how partial payments are journaled.              |

---

## 10. Open Questions

| #   | Question                                                                                         | Owner         | Status |
| --- | ------------------------------------------------------------------------------------------------ | ------------- | ------ |
| Q1  | Should the MVP support Albanian and Serbian UI languages, or English + Albanian only?            | Product       | Open   |
| Q2  | Will the MVP target individual businesses (BI) only, or all legal forms?                         | Product       | Open   |
| Q3  | Is there an existing Kosovo e-fiscalization API spec to review for future invoice schema design? | Engineering   | Open   |
| Q4  | Hosting preference: Kosovo-based data center (data residency) or EU cloud region?                | Legal / Infra | Open   |
| Q5  | Should the MVP include a print-friendly invoice view, or defer all invoice output to post-MVP?   | Product       | Open   |

---

_End of product brief._
