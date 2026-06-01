import { DecimalUtil } from "../../common/utils/decimal.helper";
import { TaxCalc } from "./tax-calculation.helper";

describe("TaxCalc.calculateExclusive", () => {
  it("net 100 @ 18% → tax 18, gross 118", () => {
    const r = TaxCalc.calculateExclusive("100", "18");
    expect(DecimalUtil.toString(r.taxAmount)).toBe("18.0000");
    expect(DecimalUtil.toString(r.grossAmount)).toBe("118.0000");
  });

  it("net 50 @ 8% → tax 4, gross 54", () => {
    const r = TaxCalc.calculateExclusive("50", "8");
    expect(DecimalUtil.toString(r.taxAmount)).toBe("4.0000");
    expect(DecimalUtil.toString(r.grossAmount)).toBe("54.0000");
  });

  it("zero rate leaves tax at 0", () => {
    const r = TaxCalc.calculateExclusive("123.45", "0");
    expect(DecimalUtil.isZero(r.taxAmount)).toBe(true);
    expect(DecimalUtil.toString(r.grossAmount)).toBe("123.4500");
  });
});

describe("TaxCalc.calculateInclusive", () => {
  it("gross 118 @ 18% → net 100, tax 18", () => {
    const r = TaxCalc.calculateInclusive("118", "18");
    expect(DecimalUtil.toString(r.netAmount)).toBe("100.0000");
    expect(DecimalUtil.toString(r.taxAmount)).toBe("18.0000");
  });

  it("inverse of exclusive: round-trip preserves the net", () => {
    const ex = TaxCalc.calculateExclusive("100", "18");
    const inc = TaxCalc.calculateInclusive(ex.grossAmount, "18");
    expect(DecimalUtil.toString(inc.netAmount)).toBe("100.0000");
    expect(DecimalUtil.toString(inc.taxAmount)).toBe("18.0000");
  });
});
