import { Injectable, Logger } from "@nestjs/common";
import { FiscalProvider } from "@prisma/client";
import type {
  FiscalizationProvider,
  FiscalizeRequest,
  FiscalizeResult,
} from "./fiscalization-provider.interface";

/**
 * Certified Electronic Fiscal Software (EFS / SEF) gateway — the real-time
 * connection to ATK.
 *
 * INTEGRATION POINT (not yet live). Implementing this requires, per
 * FISCALIZATION.md §5: ATK certification of LiFa as EFS, issued credentials, the
 * official coupon/signing specification, and a certified Secure Crypto Module.
 * Until those exist, this adapter records a FAILED result with a clear reason so
 * the requirement is visible rather than silently skipped — it never fabricates
 * an FCUIN.
 */
@Injectable()
export class AtkEfsFiscalizationProvider implements FiscalizationProvider {
  private readonly logger = new Logger(AtkEfsFiscalizationProvider.name);
  readonly code = FiscalProvider.ATK_EFS;

  // eslint-disable-next-line @typescript-eslint/require-await
  async fiscalize(req: FiscalizeRequest): Promise<FiscalizeResult> {
    this.logger.warn(
      `ATK EFS fiscalization requested for invoice ${req.invoiceId} but the certified ` +
        `integration is not configured. See FISCALIZATION.md §5.`,
    );
    return {
      status: "FAILED",
      errorMessage:
        "ATK EFS integration is not configured. Certification, credentials and the ATK " +
        "technical specification are required before live fiscalization (see FISCALIZATION.md).",
      requestPayload: { invoiceId: req.invoiceId, environment: req.config.environment },
    };
  }
}
