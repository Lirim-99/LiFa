import { Prisma } from "@prisma/client";

/**
 * All money math in LiFa goes through this helper.
 * Never use raw JS `+` / `-` / `*` on monetary values — float drift will
 * eventually break ledger balance checks.
 *
 * `Money` accepts a Prisma.Decimal, string, or number. Numbers are tolerated
 * for ergonomics in tests; production code paths read Decimals from Prisma.
 */
export type Money = Prisma.Decimal | string | number;

const D = Prisma.Decimal;
const toD = (v: Money): Prisma.Decimal => (v instanceof D ? v : new D(v));

export const DecimalUtil = {
  zero(): Prisma.Decimal {
    return new D(0);
  },

  from(v: Money): Prisma.Decimal {
    return toD(v);
  },

  add(a: Money, b: Money): Prisma.Decimal {
    return toD(a).plus(toD(b));
  },

  subtract(a: Money, b: Money): Prisma.Decimal {
    return toD(a).minus(toD(b));
  },

  multiply(a: Money, b: Money): Prisma.Decimal {
    return toD(a).times(toD(b));
  },

  divide(a: Money, b: Money): Prisma.Decimal {
    return toD(a).div(toD(b));
  },

  sum(values: Money[]): Prisma.Decimal {
    return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(toD(v)), new D(0));
  },

  isEqual(a: Money, b: Money): boolean {
    return toD(a).equals(toD(b));
  },

  isZero(a: Money): boolean {
    return toD(a).isZero();
  },

  isPositive(a: Money): boolean {
    return toD(a).gt(0);
  },

  isNegative(a: Money): boolean {
    return toD(a).lt(0);
  },

  /** Rounds to 4 decimal places (LiFa's storage precision). */
  round(a: Money): Prisma.Decimal {
    return toD(a).toDecimalPlaces(4);
  },

  /** Convenience for serialization. */
  toString(a: Money): string {
    return toD(a).toFixed(4);
  },
};
