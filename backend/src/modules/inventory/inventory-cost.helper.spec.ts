import { Prisma } from "@prisma/client";
import { costOfIssue, runningInventoryValue } from "./inventory-cost.helper";

describe("inventory cost", () => {
  it("issues at the weighted average of receipts", () => {
    const state = runningInventoryValue(
      [
        { type: "GOODS_RECEIPT", quantity: 1, unitCost: 10 },
        { type: "GOODS_RECEIPT", quantity: 1, unitCost: 20 },
      ],
      0,
    );
    expect(state.unitCost.equals(new Prisma.Decimal(15))).toBe(true);
    const cost = costOfIssue(state, 2);
    expect(cost.amount.equals(new Prisma.Decimal(30))).toBe(true);
  });

  it("ignores the selling price stored on an earlier issue", () => {
    const state = runningInventoryValue(
      [
        { type: "GOODS_RECEIPT", quantity: 10, unitCost: 2 },
        { type: "GOODS_ISSUE", quantity: 4, unitCost: 99 },
      ],
      0,
    );
    expect(state.qty.equals(6)).toBe(true);
    expect(state.value.equals(new Prisma.Decimal(12))).toBe(true);
    expect(costOfIssue(state, 4).amount.equals(new Prisma.Decimal(8))).toBe(true);
  });

  it("uses the fallback price when nothing is on hand", () => {
    const state = runningInventoryValue([], 5);
    expect(costOfIssue(state, 2).amount.equals(new Prisma.Decimal(10))).toBe(true);
  });

  it("takes the whole remaining value when the issue clears the stock", () => {
    const state = runningInventoryValue([{ type: "GOODS_RECEIPT", quantity: 2, unitCost: 4 }], 0);
    expect(costOfIssue(state, 2).amount.equals(new Prisma.Decimal(8))).toBe(true);
  });
});
