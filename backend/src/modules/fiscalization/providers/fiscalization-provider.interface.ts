import type { FiscalProvider } from "@prisma/client";

/**
 * Port for talking to a fiscalization channel (ATK EFS gateway, manual EDI, …).
 * Adapters live alongside this file. See FISCALIZATION.md for why this is an
 * abstraction rather than a hardcoded ATK call.
 */

export interface FiscalizeRequestLine {
  description: string;
  quantity: string;
  unitPrice: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  taxRatePercent: string | null;
}

export interface FiscalizeRequest {
  companyId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  issueDate: Date;
  currency: string;
  totalAmount: string;
  taxAmount: string;
  seller: { legalName: string; vatNumber: string | null; fiscalNumber: string | null };
  buyer: { name: string; vatNumber: string | null };
  lines: FiscalizeRequestLine[];
  config: {
    provider: FiscalProvider;
    environment: string;
    businessUnitCode: string | null;
    operatorCode: string | null;
    efsSoftwareCode: string | null;
    verificationBaseUrl: string | null;
  };
}

/** What a provider returns. `PENDING` means a human/offline step is still required. */
export interface FiscalizeResult {
  status: "FISCALIZED" | "FAILED" | "PENDING";
  fcuin?: string | null;
  verificationUrl?: string | null;
  qrPayload?: string | null;
  taxBlockCode?: string | null;
  errorMessage?: string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
}

export interface FiscalizationProvider {
  /** Which `FiscalProvider` this adapter implements. */
  readonly code: FiscalProvider;
  /** Submit a sale to the channel and return its fiscal result. */
  fiscalize(req: FiscalizeRequest): Promise<FiscalizeResult>;
}

/** DI token for the set of available providers. */
export const FISCALIZATION_PROVIDERS = Symbol("FISCALIZATION_PROVIDERS");
