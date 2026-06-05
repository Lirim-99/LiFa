# Fiscalization (Kosovo) — Compliance & Architecture

> Status: **foundation / integration-ready scaffold.** This document records what
> Kosovo law requires, how LiFa is structured to meet it, and exactly what is
> still needed to go live with a certified connection to the Tax Administration
> of Kosovo (ATK / Administrata Tatimore e Kosovës).

## 1. What Kosovo law requires (as of 2026)

Kosovo operates a **mandatory fiscalization system** supervised by ATK. Businesses
that issue receipts for sales must do so through an ATK-approved channel that
records the transaction and reports it to ATK:

- **Three approved channels**: an **Electronic Fiscal Device (EFD)**, a **Fiscal
  System (FS)**, or **Electronic Fiscal Software (EFS / "SEF" — Softuer Elektronik
  Fiskal)**. LiFa, as accounting software, would be an **EFS/SEF**.
- **Real-time / continuous reporting**: devices transmit encrypted sales data to
  ATK servers (mobile network + VPN), backed by a **Secure Crypto Module / Tax
  Terminal** for tamper protection and data integrity. **Daily sales reports
  (Z-reports)** are generated and sent automatically.
- **Fiscal coupon (kupon fiskal)** must carry, at minimum: seller identification
  (fiscal/VAT number), transaction timestamp, description of goods/services,
  monetary and tax amounts, **fiscal identifiers** that tie the document to the
  reporting workflow — notably the **FCUIN** (Fiscal Coupon Unique Identification
  Number) — and a **QR code** so the buyer can verify the coupon against ATK.
- **EDI system**: ATK's Electronic Declaration portal is used for fiscalization
  workflows, including **tax blocks** — a controlled offline fallback where a
  block (max **50** coupons) is fiscalized electronically and gets a **Unique Tax
  Block Code**.
- **Software notification/certification**: every taxpayer issuing fiscal coupons
  must notify ATK of the **software solution** used and its **developer and
  maintainer**. EFS goes through an ATK **certification + maintenance** process
  (application opened under Administrative Instruction MF No. **01/2026**).
- **Regulatory flux**: Administrative Instruction MFPT No. **01/2025** governed
  this but was **annulled by the Supreme Court of Kosovo on 15 July 2025**; the
  **01/2026** instruction superseded it. Treat the exact protocol as
  **version-dependent and subject to change.**

### VAT context (Law No. 05/L-037 on VAT)

- **Rates**: standard **18%**, reduced **8%** (water, electricity, basic foods,
  books, medicines, IT equipment, etc.), **0%** (exports / exempt).
- **VAT registration threshold**: turnover **> €30,000** in a calendar year
  (importers/exporters and foreign entities: from first activity).
- **VAT number format**: 9 digits, starts with `3` (e.g. `330000001`).
- **Invoice (faturë) ≠ fiscal coupon.** A fiscal coupon alone is **not**
  sufficient to support an expense for tax purposes — it must be accompanied by a
  proper VAT invoice. So LiFa must produce a compliant **invoice** *and* (for
  in-scope sales) a **fiscal coupon**; they are linked but distinct.
- **Invoice mandatory content** (EU-aligned): date of issue, sequential unique
  number, supplier name/address/VAT number, customer name/address/VAT number,
  quantity & description, taxable amount per rate, VAT rate, VAT amount, and
  exemption/zero-rating/reverse-charge references where applicable.
- **Cash cap**: cash payments over **€2,000** per transaction are prohibited.

Sources are listed at the bottom of this document.

## 2. Why a provider-abstracted design (not a hardcoded ATK call)

The live ATK protocol (exact XML/crypto signing, endpoints, the FCUIN derivation
and verification URL format) is **gated behind ATK certification**, requires
**issued credentials** and likely a **certified Secure Crypto Module**, and — as
noted — is **actively changing** (court annulment + new 2026 instruction). It would
be irresponsible to fabricate a fake "live" integration.

LiFa therefore models fiscalization as a **port/adapter**: the domain persists
everything it needs regardless of channel, and a `FiscalizationProvider` adapter
performs the actual ATK communication. Three adapters ship:

| Provider | Use |
| --- | --- |
| `NONE` (noop) | Fiscalization disabled (e.g. company below threshold / not yet certified). Default. |
| `MANUAL_EDI` | Reflects the **real, usable-today** workflow: the operator fiscalizes via ATK's EDI portal / a tax block and records the returned **FCUIN + QR** back into LiFa. No fake automation. |
| `ATK_EFS` | **Integration point** for a certified EFS/gateway. Interface is in place; the adapter throws `NotImplemented` until real credentials + the certified protocol are wired. |

This means **the data model, APIs, audit trail, and invoice linkage are correct
and complete now**, and going live is a matter of implementing one adapter against
the certified spec — without touching the rest of the system.

## 3. Data model

New Prisma models (see `backend/prisma/schema.prisma`):

- **`CompanyFiscalConfig`** (1:1 with `Company`) — per-company fiscalization
  settings: `enabled`, `provider` (`FiscalProvider`), `environment`
  (`TEST | PRODUCTION`), `businessUnitCode` (POS/unit code registered with ATK),
  `operatorCode`, `efsSoftwareCode` / `efsMaintainer` (the notified software +
  maintainer), `verificationBaseUrl` (ATK QR verification host).
- **`FiscalCoupon`** — one per fiscalized document (invoice). Holds `status`
  (`FiscalCouponStatus`: `PENDING | FISCALIZED | FAILED | VOIDED | EXEMPT`),
  `couponType` (`SALE | RETURN`), the snapshotted amounts, and the ATK results:
  `fcuin`, `qrPayload`/`verificationUrl`, `taxBlockCode`, `fiscalizedAt`, plus
  `requestPayload`/`responsePayload`/`errorMessage` for audit & retry.
- `Invoice` gains a back-relation `fiscalCoupon FiscalCoupon?`.

New enums: `FiscalProvider`, `FiscalCouponStatus`, `FiscalCouponType`.

All rows are **company-scoped** (`companyId` in every query) per backend
conventions, and money stays `Decimal(19,4)`.

## 4. Backend module (`backend/src/modules/fiscalization/`)

- `fiscalization.service.ts` — company-scoped orchestration:
  - `getConfig` / `upsertConfig`
  - `ensureCouponForIssuedInvoice(tx, companyId, invoiceId, …)` — called inside the
    invoice **issue** transaction (best-effort, like audit logging) to create a
    `PENDING` coupon when fiscalization is enabled. **Never blocks issuing** — the
    ledger is the source of truth; the coupon is reported separately, mirroring the
    legal separation of invoice vs coupon and the offline/tax-block fallback.
  - `fiscalizeInvoice(companyId, invoiceId, userId)` — runs the configured provider
    and stores the result.
  - `recordManualCoupon(companyId, invoiceId, dto, userId)` — `MANUAL_EDI`: store
    operator-supplied FCUIN/QR from the ATK EDI portal.
  - `voidCoupon(...)` — mark a coupon `VOIDED` (e.g. on invoice void).
- `providers/` — `fiscalization-provider.interface.ts` + `noop`, `manual-edi`,
  `atk-efs` adapters.
- `fiscalization.controller.ts` — REST under `/fiscalization` & `/invoices/:id`:
  - `GET /fiscalization/config`, `PUT /fiscalization/config`
  - `GET /invoices/:id/fiscal-coupon`
  - `POST /invoices/:id/fiscalize`
  - `POST /invoices/:id/fiscal-coupon/manual`
- Permissions: `fiscalization.read`, `fiscalization.manage`, `fiscalization.fiscalize`.
- Audit: new `FISCAL_COUPON` entity type and `FISCALIZED` action.

## 5. What's needed to go live (certified)

1. **ATK certification** of LiFa as EFS/SEF (Administrative Instruction 01/2026
   process) + notification of developer/maintainer.
2. **Credentials & the official technical specification** (coupon XML schema,
   signing, FCUIN derivation, verification URL, endpoints).
3. A **certified Secure Crypto Module / signing** mechanism as required.
4. Implement `AtkEfsFiscalizationProvider` against that spec; add the daily
   **Z-report** submission job.
5. Confirm **scope/exemptions** for the specific business with a Kosovo tax advisor
   (which sales must be fiscalized, cash vs all payment types).

Because of the abstraction in §2, only step 4 touches code; everything else is
configuration and paperwork.

## 6. Sources

- ATK — Administrative Instruction MFPT No. 01/2025 (EN), annulled 15 Jul 2025: https://www.atk-ks.org/wp-content/uploads/2025/04/ENG-UDHEZIM_ADMINISTRATIV_MFPT_NR._01_2025_PER___SHFRYTEZIMIN_E_PAJISJEVE_ELEKTRONIKE_FISKALE__SISTEMEVE_FISKALE_DHE_SOFTUEREVE_ELEKTRONIKE___FISKALE.pdf
- ATK — Specific technical & functional requirements for fiscal electronic devices / fiscal systems: https://www.atk-ks.org/wp-content/uploads/2019/12/SPECIFIC-TECHNICAL-AND-FUNCTIONAL-REQUIREMENTS-FOR-FISCAL-ELECTRONIC-DEVICES-FISCAL-SYSTEMS.pdf
- ATK — Notice: tax blocks fiscalized only electronically (EDI): https://www.atk-ks.org/en/notice-to-taxpayers-fiscalization-of-tax-blocks-will-be-done-only-electronically/
- ATK — Apply for EFS (SEF) certification & maintenance: https://www.atk-ks.org/njoftim-per-tatimpagues-aplikoni-per-certifikim-dhe-mirembajtje-te-softuereve-elektronike-fiskale-sef
- VATupdate — Kosovo's mandatory fiscalization system (legal scope, devices, reporting), 27 Dec 2025: https://www.vatupdate.com/2025/12/27/kosovos-mandatory-fiscalization-system-legal-scope-device-requirements-and-tax-reporting-procedures/
- VATupdate — Continuous communication: Kosovo fiscalization ↔ ATK, 22 Jan 2026: https://www.vatupdate.com/2026/01/22/continuous-communication-how-kosovos-fiscalization-system-connects-businesses-with-the-tax-administration/
- invoicedataextraction — Kosovo fiscalization requirements (EFS, QR, tax blocks): https://invoicedataextraction.com/blog/kosovo-fiscalization-requirements
- Evropa e Lirë — what the (annulled) fiscal-device instruction provided: https://www.evropaelire.org/a/udhezimi-per-arka-fiskale/33475821.html
- PwC Worldwide Tax Summaries — Kosovo VAT (rates, threshold, invoicing): https://taxsummaries.pwc.com/kosovo/corporate/other-taxes
- Kosovo Law No. 05/L-037 on VAT: https://www.atk-ks.org/wp-content/uploads/2017/07/LAW_NO._05_L-037_ON_VALUE_ADDED_TAX___ANNEX.pdf
