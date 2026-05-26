import { Prisma } from "@prisma/client";
import { DecimalUtil } from "./decimal.helper";

describe("DecimalUtil", () => {
  it("add: avoids JS float drift", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in plain JS
    expect(DecimalUtil.toString(DecimalUtil.add("0.1", "0.2"))).toBe("0.3000");
  });

  it("subtract: produces exact results", () => {
    expect(DecimalUtil.toString(DecimalUtil.subtract("100.50", "33.25"))).toBe("67.2500");
  });

  it("multiply: maintains precision across many operations", () => {
    const qty = "3";
    const price = "19.95";
    expect(DecimalUtil.toString(DecimalUtil.multiply(qty, price))).toBe("59.8500");
  });

  it("sum: handles empty array", () => {
    expect(DecimalUtil.isZero(DecimalUtil.sum([]))).toBe(true);
  });

  it("sum: adds three invoice-line totals exactly", () => {
    const lines = ["100.00", "33.33", "66.67"];
    expect(DecimalUtil.toString(DecimalUtil.sum(lines))).toBe("200.0000");
  });

  it("isEqual: treats different representations of the same value as equal", () => {
    expect(DecimalUtil.isEqual("100.00", new Prisma.Decimal("100"))).toBe(true);
    expect(DecimalUtil.isEqual("100.00", 100)).toBe(true);
    expect(DecimalUtil.isEqual("100.0001", "100.0000")).toBe(false);
  });

  it("isPositive / isNegative / isZero", () => {
    expect(DecimalUtil.isPositive("0.0001")).toBe(true);
    expect(DecimalUtil.isPositive("0")).toBe(false);
    expect(DecimalUtil.isNegative("-0.0001")).toBe(true);
    expect(DecimalUtil.isZero("0")).toBe(true);
  });

  it("balance check: sum of debits equals sum of credits", () => {
    // Common assertion that all posted journal entries must satisfy.
    const debits = ["1180.00"];
    const credits = ["1000.00", "180.00"]; // net revenue + VAT
    expect(DecimalUtil.isEqual(DecimalUtil.sum(debits), DecimalUtil.sum(credits))).toBe(true);
  });
});
