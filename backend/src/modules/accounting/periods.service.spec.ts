import { buildMonthlyPeriods } from "./periods.service";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

describe("buildMonthlyPeriods", () => {
  it("calendar fiscal year (start month = 1) covers Jan–Dec of the same calendar year", () => {
    const periods = buildMonthlyPeriods(2026, 1);
    expect(periods).toHaveLength(12);
    expect(isoDate(periods[0].startDate)).toBe("2026-01-01");
    expect(isoDate(periods[0].endDate)).toBe("2026-01-31");
    expect(isoDate(periods[11].startDate)).toBe("2026-12-01");
    expect(isoDate(periods[11].endDate)).toBe("2026-12-31");
  });

  it("non-January fiscal year spans into the next calendar year", () => {
    // start month = 7 → FY2026 runs 2026-07-01 .. 2027-06-30
    const periods = buildMonthlyPeriods(2026, 7);
    expect(isoDate(periods[0].startDate)).toBe("2026-07-01");
    expect(isoDate(periods[5].endDate)).toBe("2026-12-31");
    expect(isoDate(periods[6].startDate)).toBe("2027-01-01");
    expect(isoDate(periods[11].endDate)).toBe("2027-06-30");
  });

  it("February respects the calendar year (leap and common)", () => {
    const common = buildMonthlyPeriods(2026, 2);
    expect(isoDate(common[0].endDate)).toBe("2026-02-28");
    const leap = buildMonthlyPeriods(2028, 2);
    expect(isoDate(leap[0].endDate)).toBe("2028-02-29");
  });

  it("end-of-month dates are correct for 30-day months", () => {
    const periods = buildMonthlyPeriods(2026, 1);
    expect(isoDate(periods[3].endDate)).toBe("2026-04-30");
    expect(isoDate(periods[5].endDate)).toBe("2026-06-30");
    expect(isoDate(periods[8].endDate)).toBe("2026-09-30");
    expect(isoDate(periods[10].endDate)).toBe("2026-11-30");
  });
});
