import { Prisma } from "@prisma/client";

const INBOUND = new Set(["GOODS_RECEIPT", "TRANSFER_IN", "ADJUSTMENT_IN", "RETURN_IN"]);

export interface CostMovement {
  type: string;
  quantity: Prisma.Decimal.Value;
  unitCost?: Prisma.Decimal.Value | null;
}

export interface InventoryState {
  qty: Prisma.Decimal;
  value: Prisma.Decimal;
  unitCost: Prisma.Decimal;
}

/**
 * Weighted-average quantity and value. Issues reduce value at the running
 * average; they ignore the unit cost stored on the outbound row (older issues
 * were recorded at selling price).
 */
export function runningInventoryValue(
  movements: CostMovement[],
  fallbackUnitCost: Prisma.Decimal.Value,
): InventoryState {
  let qty = new Prisma.Decimal(0);
  let value = new Prisma.Decimal(0);
  const fallback = new Prisma.Decimal(fallbackUnitCost ?? 0);

  for (const movement of movements) {
    const q = new Prisma.Decimal(movement.quantity).abs();
    if (q.isZero()) continue;
    if (INBOUND.has(movement.type)) {
      const cost = movement.unitCost == null ? fallback : new Prisma.Decimal(movement.unitCost);
      value = value.plus(q.times(cost));
      qty = qty.plus(q);
    } else {
      const avg = qty.gt(0) ? value.div(qty) : fallback;
      const onHand = qty.gt(0) ? qty : new Prisma.Decimal(0);
      const take = Prisma.Decimal.min(q, onHand);
      value = value.minus(take.times(avg));
      qty = qty.minus(q);
      if (value.isNeg()) value = new Prisma.Decimal(0);
    }
  }

  const unitCost = qty.gt(0) ? value.div(qty) : fallback;
  return {
    qty,
    value: value.toDecimalPlaces(4),
    unitCost: unitCost.toDecimalPlaces(4),
  };
}

/** Cost of taking `issueQty` out of `state`. Extra units above on-hand use the fallback average. */
export function costOfIssue(
  state: InventoryState,
  issueQty: Prisma.Decimal.Value,
): { unitCost: Prisma.Decimal; amount: Prisma.Decimal } {
  const q = new Prisma.Decimal(issueQty);
  if (q.lte(0)) return { unitCost: state.unitCost, amount: new Prisma.Decimal(0) };
  if (state.qty.gt(0) && q.gte(state.qty)) {
    const extra = q.minus(state.qty);
    const amount = state.value.plus(state.unitCost.times(extra));
    return { unitCost: state.unitCost, amount: amount.toDecimalPlaces(4) };
  }
  return {
    unitCost: state.unitCost,
    amount: state.unitCost.times(q).toDecimalPlaces(4),
  };
}
