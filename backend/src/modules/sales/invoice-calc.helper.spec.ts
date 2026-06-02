import { DecimalUtil } from "../../common/utils/decimal.helper";
import { InvoiceCalc } from "./invoice-calc.helper";

describe("InvoiceCalc.calculateLine", () => {
  it("untaxed line: net = qty * price", () => {
    const r = InvoiceCalc.calculateLine({ quantity: "3", unitPrice: "10.00" });
    expect(DecimalUtil.toString(r.netAmount)).toBe("30.0000");
    expect(DecimalUtil.isZero(r.taxAmount)).toBe(true);
    expect(DecimalUtil.toString(r.totalAmount)).toBe("30.0000");
  });

  it("exclusive 18% VAT: net 100 → tax 18, total 118", () => {
    const r = InvoiceCalc.calculateLine({
      quantity: "1",
      unitPrice: "100",
      taxRate: { rate: "18", calculationType: "EXCLUSIVE" },
    });
    expect(DecimalUtil.toString(r.netAmount)).toBe("100.0000");
    expect(DecimalUtil.toString(r.taxAmount)).toBe("18.0000");
    expect(DecimalUtil.toString(r.totalAmount)).toBe("118.0000");
  });

  it("inclusive 18% VAT: line price IS gross → back out net + tax", () => {
    const r = InvoiceCalc.calculateLine({
      quantity: "1",
      unitPrice: "118",
      taxRate: { rate: "18", calculationType: "INCLUSIVE" },
    });
    expect(DecimalUtil.toString(r.netAmount)).toBe("100.0000");
    expect(DecimalUtil.toString(r.taxAmount)).toBe("18.0000");
    expect(DecimalUtil.toString(r.totalAmount)).toBe("118.0000");
  });

  it("percentage discount reduces the net before tax", () => {
    const r = InvoiceCalc.calculateLine({
      quantity: "1",
      unitPrice: "100",
      discountType: "PERCENTAGE",
      discountValue: "10",
      taxRate: { rate: "18", calculationType: "EXCLUSIVE" },
    });
    expect(DecimalUtil.toString(r.netAmount)).toBe("90.0000");
    expect(DecimalUtil.toString(r.taxAmount)).toBe("16.2000");
    expect(DecimalUtil.toString(r.totalAmount)).toBe("106.2000");
  });

  it("fixed discount reduces the net before tax", () => {
    const r = InvoiceCalc.calculateLine({
      quantity: "1",
      unitPrice: "100",
      discountType: "FIXED",
      discountValue: "25",
    });
    expect(DecimalUtil.toString(r.netAmount)).toBe("75.0000");
  });

  it("fixed discount larger than the line clamps to zero", () => {
    const r = InvoiceCalc.calculateLine({
      quantity: "1",
      unitPrice: "10",
      discountType: "FIXED",
      discountValue: "999",
    });
    expect(DecimalUtil.isZero(r.netAmount)).toBe(true);
  });
});

describe("InvoiceCalc.calculateInvoiceTotals", () => {
  it("sums net + tax + total across lines", () => {
    const a = InvoiceCalc.calculateLine({
      quantity: "2",
      unitPrice: "50",
      taxRate: { rate: "18", calculationType: "EXCLUSIVE" },
    });
    const b = InvoiceCalc.calculateLine({
      quantity: "1",
      unitPrice: "100",
      taxRate: { rate: "8", calculationType: "EXCLUSIVE" },
    });
    const totals = InvoiceCalc.calculateInvoiceTotals([a, b]);
    // a: net 100, tax 18, total 118. b: net 100, tax 8, total 108.
    expect(DecimalUtil.toString(totals.subtotalAmount)).toBe("200.0000");
    expect(DecimalUtil.toString(totals.taxAmount)).toBe("26.0000");
    expect(DecimalUtil.toString(totals.totalAmount)).toBe("226.0000");
  });
});
