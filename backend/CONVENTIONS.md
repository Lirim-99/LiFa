# Backend Conventions

A short reference for everyone working on the NestJS backend. Anything that contradicts these notes is a bug, not a style choice.

## 1. Module structure

Each domain module lives under `src/modules/<name>/` and contains:

```
src/modules/<name>/
├── <name>.module.ts        # NestJS module
├── <name>.controller.ts    # HTTP layer; no business logic
├── <name>.service.ts       # business logic; talks to Prisma + other services
├── dto/                    # request/response DTOs (class-validator decorators)
└── interfaces/             # optional: shared types used inside the module
```

Tests sit next to the file they cover: `foo.service.spec.ts` for unit, `foo.e2e-spec.ts` for integration.

Cross-cutting infrastructure lives under `src/common/` and is exported through `CommonModule` (global). Database access lives under `src/prisma/`.

## 2. Company scoping is explicit

Every service method that touches company-scoped data takes `companyId` as a parameter and includes it in **every** Prisma `where`, `create`, etc. There is no global Prisma middleware doing it for you.

```typescript
async findById(companyId: string, id: string): Promise<Contact> {
  const contact = await this.prisma.contact.findFirst({
    where: { id, companyId },
  });
  if (!contact) throw new NotFoundException();
  return contact;
}
```

Rules:

- `companyId` is the **first** parameter (after `tx` if a transaction client is also passed).
- Return `NotFoundException`, not `ForbiddenException`, on a cross-company mismatch — don't leak existence.
- Every domain spec includes an isolation test using `expectCompanyIsolation()` from `src/common/testing`.

## 3. Money is `Decimal(19,4)`. Always.

Never use `+`, `-`, `*`, `/` on monetary values. Use `DecimalUtil` from `src/common/utils`.

```typescript
import { DecimalUtil } from "../common";
const total = DecimalUtil.sum(lines.map((l) => l.totalAmount));
if (!DecimalUtil.isEqual(debits, credits)) throw new Error("unbalanced");
```

Mixing `number` and `Decimal` arithmetic is the most common source of off-by-a-cent bugs in accounting systems. The helper accepts strings, numbers, and `Prisma.Decimal` so call sites stay clean.

## 4. Transactions for accounting flows

Every flow that touches the ledger runs in a single `prisma.$transaction(async (tx) => {...})`:

- Invoice issue (create journal entry + assign invoice number + assign entry number)
- Invoice void (create reversal entry + flip status)
- Payment create (allocations + journal entry)
- Payment void (reversal entry + restore invoice balances)
- Manual journal entry post (assign number + period + status)

If any step throws, the entire flow rolls back — including the document number from `DocumentSequenceService.nextNumber`, so sequences stay gap-free.

## 5. Document numbering

- Invoice numbers and journal entry numbers are `NULL` while the document is `DRAFT`.
- Numbers are assigned only inside the issue/post transaction via `DocumentSequenceService.nextNumber(tx, companyId, documentType, fiscalYear)`.
- The sequence row is per `(company, document_type, fiscal_year)` and is auto-created on first use.

## 6. Posted entries are immutable

`JournalEntry.status` is `DRAFT | POSTED`. There is no `VOID` status on journal entries. A void is a **new** entry with `status = POSTED`, `reversal_of_entry_id` pointing at the original, and debits ↔ credits swapped. The original is left untouched; reports keep summing both and the net effect is zero.

## 7. Audit logging is explicit

Call `AuditService.log(...)` (added in Step 10) from inside the service method that performs the critical action — not a generic interceptor. Failure to log must NOT fail the parent transaction; the audit service swallows its own errors.

## 8. DTOs and validation

Every DTO uses `class-validator` decorators. The global `ValidationPipe` is configured with `whitelist: true` and `forbidNonWhitelisted: true`, so:

- Extra properties on the request body → 400.
- Missing required properties → 400.
- Type mismatches → 400 (after `@Type()` transformation).

Reuse `PaginationQueryDto` and `paginatedResponse()` from `src/common/dto` for list endpoints.

## 9. Errors

- Throw NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, ...) for known cases.
- `HttpExceptionFilter` shapes everything into `{ statusCode, message, error, timestamp, path }`.
- `PrismaExceptionFilter` translates Prisma error codes — don't catch and re-throw Prisma errors yourself just to map status codes.

## 10. Tests

- `*.spec.ts` next to the file under test for unit tests.
- Mock Prisma at the service layer only when there is no real database flow to exercise (e.g. pure calculation). Otherwise integration tests against a test database are preferred.
- Every domain module has an isolation test.
