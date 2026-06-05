import { Injectable } from "@nestjs/common";
import { FiscalProvider } from "@prisma/client";
import type { FiscalizationProvider, FiscalizeResult } from "./fiscalization-provider.interface";

/**
 * Manual EDI workflow — reflects what is actually possible today: the operator
 * fiscalizes the sale through ATK's EDI portal (or a tax block) and records the
 * returned FCUIN + QR back into LiFa via the "record manual coupon" endpoint.
 *
 * There is nothing to call automatically, so `fiscalize()` simply reports that
 * a manual step is pending. The real value is captured by
 * `FiscalizationService.recordManualCoupon(...)`.
 */
@Injectable()
export class ManualEdiFiscalizationProvider implements FiscalizationProvider {
  readonly code = FiscalProvider.MANUAL_EDI;

  // eslint-disable-next-line @typescript-eslint/require-await
  async fiscalize(): Promise<FiscalizeResult> {
    return {
      status: "PENDING",
      errorMessage:
        "Manual EDI: fiscalize this sale in the ATK EDI portal, then record the FCUIN and QR code.",
    };
  }
}
