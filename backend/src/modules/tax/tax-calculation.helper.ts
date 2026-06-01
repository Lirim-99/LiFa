import { DecimalUtil, type Money } from "../../common/utils/decimal.helper";
import type { Prisma } from "@prisma/client";

/**
 * VAT-style tax calculation. All math via Decimal — never float.
 *
 *   EXCLUSIVE: net is the line price entered; tax adds on top.
 *     net = 100, rate = 18%  →  tax = 18.0000, gross = 118.0000
 *
 *   INCLUSIVE: gross is the line price entered; net + tax extracted from it.
 *     gross = 118, rate = 18%  →  net = 100.0000, tax = 18.0000
 */
export const TaxCalc = {
  calculateExclusive(netAmount: Money, ratePercent: Money) {
    const net = DecimalUtil.from(netAmount);
    const tax = DecimalUtil.round(DecimalUtil.divide(DecimalUtil.multiply(net, ratePercent), 100));
    const gross = DecimalUtil.add(net, tax);
    return { netAmount: net, taxAmount: tax, grossAmount: gross } as const;
  },

  calculateInclusive(grossAmount: Money, ratePercent: Money) {
    const gross = DecimalUtil.from(grossAmount);
    // net = gross / (1 + rate/100)
    const divisor = DecimalUtil.add(1, DecimalUtil.divide(ratePercent, 100));
    const net = DecimalUtil.round(DecimalUtil.divide(gross, divisor));
    const tax = DecimalUtil.subtract(gross, net);
    return { netAmount: net, taxAmount: tax, grossAmount: gross } as const;
  },
};

export type TaxCalcResult = {
  netAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
};
