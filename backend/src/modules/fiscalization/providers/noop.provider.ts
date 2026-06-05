import { Injectable } from "@nestjs/common";
import { FiscalProvider } from "@prisma/client";
import type { FiscalizationProvider, FiscalizeResult } from "./fiscalization-provider.interface";

/** Fiscalization disabled. Should not be invoked when config is off; if it is,
 *  it returns FAILED so the reason is visible rather than silently passing. */
@Injectable()
export class NoopFiscalizationProvider implements FiscalizationProvider {
  readonly code = FiscalProvider.NONE;

  // eslint-disable-next-line @typescript-eslint/require-await
  async fiscalize(): Promise<FiscalizeResult> {
    return { status: "FAILED", errorMessage: "Fiscalization is not enabled for this company." };
  }
}
