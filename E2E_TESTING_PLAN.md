# LiFa — End-to-End Testing Plan

Version: 0.1 | Status: Draft

## 1. Goal

Give us confidence that the core accounting flows are correct end-to-end:

- **Ledger integrity** — every issued invoice and recorded payment leaves the
  ledger balanced, with the right account postings, in the right period.
- **Authorization** — users can't escape their company; roles can't act outside
  their permission set.
- **Lifecycle** — DRAFT → ISSUED → PAID → VOID transitions enforce all the rules
  baked into the services (closed periods, already-reversed entries, etc.).

Non-goals (for now): visual regression, performance, load.

## 2. Layering

| Layer | Tooling | What it covers | Cost | Priority |
|-------|---------|----------------|------|----------|
| **L1 — Backend API e2e** | Jest + supertest + real Postgres | NestJS HTTP layer through Prisma to DB. Catches transaction bugs, permission gaps, ledger arithmetic. | Moderate | **Highest** |
| **L2 — Frontend browser e2e** | Playwright | App in a real browser: forms, state, BFF proxy, cookies, redirects. | High (flaky-prone) | Medium |
| **L3 — Smoke** | curl / Playwright `--reporter=line` | `/health` + login round-trip in CI on every deploy. | Low | Nice to have |

We already have **101 unit tests** at the service layer; they stay. L1 is the
gap that has the most leverage — it's where the bugs we'd actually ship live.

## 3. Test data strategy

- **Dedicated DB per run**: `lifa_test` (port 5432) — same Postgres container, separate database. A `beforeAll` hook runs `prisma migrate deploy` + `prisma db seed` against it.
- **Truncate-between-tests**, not migrate-between-tests. A `truncateAll()` helper wipes every business table (CASCADE) and re-seeds reference data (roles + tax templates) once per `describe` block.
- **Fixtures via builders**, not factories. Tiny helpers like `givenAUserWithCompany()` that return real DB IDs. Keeps tests readable; avoids the "where is this row coming from?" problem.
- **No mocks at L1**. The whole point is the real path.

## 4. CI

- GitHub Actions workflow `e2e.yml`:
  1. Bring up Postgres via `services:` block.
  2. Install + build backend.
  3. `prisma migrate deploy` + seed against `lifa_test`.
  4. Run Jest e2e suite.
  5. (Later) start backend + frontend, run Playwright suite headless.
- Run on PRs and on `main`. Block merge on failure.

---

## 5. L1 — Backend API e2e plan

### 5.1 Setup files

```
backend/
├── test/
│   ├── app.e2e-spec.ts           # /health smoke
│   ├── setup/
│   │   ├── jest-e2e.config.ts    # replaces jest-e2e.json
│   │   ├── test-app.ts           # bootstraps Nest app with TestingModule
│   │   ├── test-db.ts            # truncateAll(), seedRoles()
│   │   └── fixtures.ts           # givenAUser, givenACompany, givenAnIssuedInvoice…
│   ├── auth.e2e-spec.ts
│   ├── companies.e2e-spec.ts
│   ├── permissions.e2e-spec.ts
│   ├── contacts.e2e-spec.ts
│   ├── invoices.e2e-spec.ts      # ← biggest suite
│   ├── payments.e2e-spec.ts
│   ├── journal-entries.e2e-spec.ts
│   ├── periods.e2e-spec.ts
│   ├── isolation.e2e-spec.ts     # cross-company isolation matrix
│   └── reports.e2e-spec.ts
└── .env.test                      # DATABASE_URL=…/lifa_test, JWT_SECRET=test-secret
```

### 5.2 What each suite asserts

#### `auth.e2e-spec.ts`
- POST `/auth/register` creates user + returns id+email.
- POST `/auth/login` returns access + refresh tokens.
- POST `/auth/login` with wrong password → 401.
- Protected route (`GET /users/me`) → 401 without token, 200 with valid JWT.
- POST `/auth/refresh` with refresh token → fresh access token.
- POST `/auth/refresh` with access token → 401 (wrong type).
- Login is **timing-uniform** for unknown emails (informational — measure both paths, assert similar duration).

#### `companies.e2e-spec.ts`
- POST `/companies` creates the company + access row + document sequences + chart of accounts + accounting periods + tax-rate copies + account defaults — **all in one transaction**. Verify each table has rows.
- POST `/companies` failure simulation: temporarily remove the `owner` role → request fails AND no partial company row remains (transaction rollback).
- PATCH `/companies/:id` updates fields + writes audit log.
- GET `/companies` returns only the requester's companies.

#### `permissions.e2e-spec.ts` — the matrix
For each role × each permission, assert the API call succeeds or returns 403:

```
                contacts.create  invoices.issue  permissions.manage  reports.read
owner                  ✓               ✓                ✓                ✓
admin                  ✓               ✓                ✓                ✓
accountant             ✓               ✓                ✗                ✓
viewer                 ✗               ✗                ✗                ✓
```

- `removeUser`: cannot remove self → 403.
- `removeUser`: cannot remove the last `owner` → 403.

#### `contacts.e2e-spec.ts`
- POST `/contacts` with both flags false → 400 (DTO) + DB CHECK guard.
- POST with `is_customer=true` → 201.
- PATCH flipping both flags to false → 400.
- DELETE → soft-deactivate; row stays in DB; default list excludes it.

#### `invoices.e2e-spec.ts` — **most important**
For a freshly issued invoice ($100 net + 18% VAT = $118 total):
- `status` flips DRAFT → ISSUED in one transaction.
- `invoiceNumber` populated, format matches `INV-YYYY-NNNNN`.
- `postedJournalEntryId` set.
- Journal entry exists with `status=POSTED`, period assigned, entry_number assigned.
- 3 journal entry lines:
  - DEBIT Accounts Receivable 118.00
  - CREDIT Sales Revenue 100.00
  - CREDIT VAT Payable 18.00
- `sum(debits) === sum(credits)`.

Negative paths:
- Issue invoice with `issueDate` in a **closed period** → 400, status stays DRAFT, no number consumed.
- Issue invoice when **AR default not configured** → 400 + rollback.
- Issue invoice with **zero lines** → 400.
- Issue invoice referencing an **inactive customer** → 400.
- Issue **two invoices in parallel** → numbers are 1 and 2 (no collision, no gap). Use `Promise.all([fetch, fetch])` against the running app; assert numbers are sequential.

Void:
- Void issued invoice → original entry stays `POSTED`, reversal entry created with `reversalOfEntryId` set, original's `reversedByEntryId` set, invoice `status=VOID`, `voidedJournalEntryId` set.
- Void invoice with payments allocated → 409.
- Double-void → 409.

Drafts:
- Edit DRAFT → recomputes totals; succeeds.
- Edit ISSUED → 400.
- DELETE DRAFT → 204.
- DELETE ISSUED → 400.

#### `payments.e2e-spec.ts`
- Create payment with allocations summing exactly to total → 201; invoice paid_amount + balance_due updated; status flipped to PAID/PARTIALLY_PAID; journal entry DEBIT Cash/Bank, CREDIT AR, balanced.
- Sum mismatch (over or under) → 400.
- Off-by-cent (Decimal-strict) → 400.
- Allocation > invoice balance → 400.
- Allocation to invoice from a different contact → 400.
- Allocation to a DRAFT invoice → 400.
- Void payment → allocations soft-voided (`is_voided=true`, kept in DB), invoice balances restored, reversal entry posted, original entry still POSTED.

#### `journal-entries.e2e-spec.ts`
- POST manual draft → no number assigned.
- Post unbalanced entry → 400.
- Post into closed period → 400.
- Post → number assigned, period set, status POSTED.
- Void manual entry → reversal entry with mirrored lines.
- Void already-reversed → 409.
- Void invoice-generated entry directly → 400 (must go through the source).

#### `periods.e2e-spec.ts`
- Generate periods for a fiscal year → 12 monthly rows, all OPEN.
- Generate twice → 409 (conflict).
- Close period that contains a DRAFT journal entry → 400.
- Close → status CLOSED, closedAt + closedBy set.
- Reopen → status back to OPEN.

#### `isolation.e2e-spec.ts`
Cross-company leak tests using two seeded companies + two users (one each):

| Action | Expected |
|--------|----------|
| User A reads B's invoice by ID | 404 |
| User A lists invoices while authenticated as B's company | only B's data |
| User A switches X-Company-Id header to B without access | 403 |
| User A tries to attach contact from B to A's invoice | 400 (FK + scope check) |

#### `reports.e2e-spec.ts`
Set up a minimal ledger (1 invoice + 1 payment), then:
- Trial Balance over the period → debits == credits exactly.
- General Ledger for AR account → 2 lines (debit on issue, credit on payment), closing balance 0.
- P&L → revenue equals invoice net, expenses 0, net income = revenue.
- Balance Sheet as-of after payment → Bank + (small VAT) = Liabilities + Equity (retained earnings).
- AR Aging with `asOf` past due date → invoice falls into the right bucket.

### 5.3 Helpers — `fixtures.ts` API sketch

```ts
export async function givenAUser(overrides?: Partial<RegisterDto>): Promise<{
  user: User;
  accessToken: string;
}>;

export async function givenACompany(opts: { ownerToken: string }): Promise<{
  company: Company;
  ownerToken: string;
  companyId: string;
}>;

export async function givenAnIssuedInvoice(opts: {
  ownerToken: string;
  companyId: string;
  contactId?: string; // creates one if not provided
  lines?: CreateInvoiceLineDto[];
}): Promise<Invoice>;
```

These do real HTTP calls — they're the same fixtures the test would use, just
without the assertions. Keeps tests short.

### 5.4 Build order (L1)

| Phase | Output |
|-------|--------|
| 1a | `setup/` files: TestingModule bootstrap, test DB connection, truncate helper, basic fixtures. |
| 1b | `auth.e2e-spec.ts` + `app.e2e-spec.ts` (smoke). Proves the harness works. |
| 1c | `companies.e2e-spec.ts` — verifies the company-creation transaction (highest-impact). |
| 1d | `invoices.e2e-spec.ts` — the big one. |
| 1e | `payments.e2e-spec.ts`. |
| 1f | `journal-entries.e2e-spec.ts` + `periods.e2e-spec.ts`. |
| 1g | `permissions.e2e-spec.ts` + `isolation.e2e-spec.ts`. |
| 1h | `reports.e2e-spec.ts`. |

After 1c–1e the test harness has paid for itself.

---

## 6. L2 — Frontend browser e2e (Playwright)

### 6.1 Setup

```
frontend/
├── tests/
│   ├── fixtures.ts          # authenticatedPage(), seededCompany()
│   ├── auth.spec.ts
│   ├── onboarding.spec.ts
│   ├── invoice-lifecycle.spec.ts
│   ├── payment-flow.spec.ts
│   └── reports.spec.ts
├── playwright.config.ts
└── .env.test                 # points to a running backend + test DB
```

The setup expects a backend running against `lifa_test`. `playwright.config.ts`
sets `webServer.command = "pnpm dev"` so a single `pnpm playwright test` can
spin up both servers.

### 6.2 Scenarios (5 golden paths, ~20 minutes total)

1. **Register → onboard → dashboard**
   - Fresh email + password → land on `/`.
   - Zero companies → auto-redirect to `/companies/new`.
   - Fill legal name + form, submit → land on `/` with the new company in the switcher.

2. **Multi-company switcher**
   - Pre-seed user with 2 companies. Verify switcher dropdown shows both.
   - Click second → URL stays at `/`, header shows new name, contacts list re-fetches.

3. **Invoice lifecycle**
   - Create draft (one line, 18% VAT).
   - Watch the live totals row sum correctly client-side.
   - Save → row appears in list with `draft` badge.
   - Issue → invoice number appears, status `ISSUED`, totals on the row match.
   - Click row → editor disabled.

4. **Payment + invoice flips to PAID**
   - Continuing from the invoice above.
   - Record payment → allocation table shows the open invoice → enter full balance → "Matches" badge → submit.
   - Invoice list now shows `PAID` badge.
   - Void the payment → status flips back to `ISSUED`.

5. **Reports reconcile**
   - After scenarios 3 + 4, hit `/reports/trial-balance` → "Balanced" badge visible.
   - Hit `/reports/profit-and-loss` → revenue equals the invoice net.
   - Hit `/reports/balance-sheet` → "A = L + E" badge green.

### 6.3 Auth fixture

```ts
export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    // Seed a user + company directly via backend HTTP (faster than UI register).
    const { accessToken, companyId } = await seedUserAndCompany();
    await page.context().addCookies([
      { name: "lifa_at", value: accessToken, domain: "localhost", path: "/" },
      { name: "lifa_company", value: companyId, domain: "localhost", path: "/" },
    ]);
    await use(page);
  },
});
```

This skips the UI register step for every test that doesn't actually test
register, cutting suite time roughly in half.

### 6.4 Flake budget

Tolerate **zero retries** locally. CI gets one retry per test (Playwright's
default). Anything that needs more retries is a bug.

---

## 7. L3 — Smoke

A 30-second job:

```bash
curl -fs http://localhost:3001/health | grep '"ok"'
curl -fs http://localhost:3000/login | grep 'Sign in'
```

Runs on every deploy. Catches "build is broken but Jest passed" cases.

---

## 8. Open questions

1. **Test DB**: same Docker container, separate database — or a second container? Same container is cheaper; second is safer for parallel runs.
2. **Truncate vs reset**: `TRUNCATE … CASCADE` between tests is fast (<5ms). Drop+migrate is safer but adds ~5s per file. Default to truncate; offer a `--reset` flag if a test ends up corrupting state.
3. **Playwright in CI**: skip for the first iteration? L1 alone catches ~90% of what would ever break. Add L2 once we have a real user testing the happy path manually.

---

## 9. Recommended cut for the first pass

If we want a usable e2e suite in **one session**, build:

1. `setup/` + `auth.e2e-spec.ts` + `app.e2e-spec.ts` (3 hours).
2. `companies.e2e-spec.ts` (1 hour).
3. `invoices.e2e-spec.ts` covering issue + void + balance assertions (3 hours).
4. `payments.e2e-spec.ts` covering record + void (2 hours).

That's the high-leverage 9-hour subset. Everything else can ride on top of the
same harness in follow-up sessions.
