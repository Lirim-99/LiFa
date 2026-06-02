import type { Prisma, TaxCalculationType, DiscountType } from "@prisma/client";
import { DecimalUtil, type Money } from "../../common/utils/decimal.helper";

/**
 * Pure invoice-line and invoice-total math. No I/O. Exported so the issue
 * flow can recalculate from primary sources (the persisted tax rates) without
 * trusting whatever totals were stamped onto the draft earlier.
 */

export interface LineCalcInput {
  quantity: Money;
  unitPrice: Money;
  discountType?: DiscountType | null;
  discountValue?: Money | null;
  /** Pulled from TaxRate at call site; null = untaxed line. */
  taxRate?: { rate: Money; calculationType: TaxCalculationType } | null;
}

export interface LineCalcOutput {
  netAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

export const InvoiceCalc = {
  /**
   * Resolves a single invoice line to (net, tax, total). Treats:
   *   - PERCENTAGE discount as `net = net * (1 - value/100)`
   *   - FIXED discount as `net = net - value` (clamped at 0)
   *   - EXCLUSIVE tax as `tax = net * rate/100`, gross = net + tax
   *   - INCLUSIVE tax as the entered line price IS the gross — we back out net.
   */
  calculateLine(input: LineCalcInput): LineCalcOutput {
    let net = DecimalUtil.multiply(input.quantity, input.unitPrice);

    if (input.discountType && input.discountValue != null) {
      const v = DecimalUtil.from(input.discountValue);
      if (input.discountType === "PERCENTAGE") {
        const factor = DecimalUtil.subtract(1, DecimalUtil.divide(v, 100));
        net = DecimalUtil.multiply(net, factor);
      } else {
        net = DecimalUtil.subtract(net, v);
      }
      if (DecimalUtil.isNegative(net)) net = DecimalUtil.zero();
    }

    net = DecimalUtil.round(net);

    let tax = DecimalUtil.zero();
    let total = net;
    if (input.taxRate) {
      if (input.taxRate.calculationType === "EXCLUSIVE") {
        tax = DecimalUtil.round(
          DecimalUtil.divide(DecimalUtil.multiply(net, input.taxRate.rate), 100),
        );
        total = DecimalUtil.add(net, tax);
      } else {
        // INCLUSIVE: line price IS gross; back out net + tax.
        const gross = net;
        const divisor = DecimalUtil.add(1, DecimalUtil.divide(input.taxRate.rate, 100));
        net = DecimalUtil.round(DecimalUtil.divide(gross, divisor));
        tax = DecimalUtil.subtract(gross, net);
        total = gross;
      }
    }

    return { netAmount: net, taxAmount: tax, totalAmount: total };
  },

  /** Sums per-line amounts into invoice-header totals. */
  calculateInvoiceTotals(lines: LineCalcOutput[]) {
    return {
      subtotalAmount: DecimalUtil.sum(lines.map((l) => l.netAmount)),
      taxAmount: DecimalUtil.sum(lines.map((l) => l.taxAmount)),
      totalAmount: DecimalUtil.sum(lines.map((l) => l.totalAmount)),
    };
  },
};
