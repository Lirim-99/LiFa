import { BadRequestException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

// Focused on the synchronous pre-transaction validation (allocation-sum equality).
// Full transactional behaviour is covered by e2e tests against Postgres.

function makeService() {
  const prisma = {
    $transaction: jest.fn(),
  };
  const docSeq = { nextNumber: jest.fn() };
  const audit = { log: jest.fn() };
  return new PaymentsService(prisma as never, docSeq as never, audit as never);
}

describe("PaymentsService.create — allocation-sum equality (MVP rule)", () => {
  const baseDto = {
    contactId: "co-1",
    paymentMethod: "CASH" as const,
    paymentDate: new Date(),
  };

  it("rejects when allocations sum less than the payment total", async () => {
    const service = makeService();
    await expect(
      service.create(
        "co",
        {
          ...baseDto,
          totalAmount: 100,
          allocations: [{ invoiceId: "inv-1", allocatedAmount: 50 }],
        },
        "u",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when allocations sum more than the payment total", async () => {
    const service = makeService();
    await expect(
      service.create(
        "co",
        {
          ...baseDto,
          totalAmount: 100,
          allocations: [
            { invoiceId: "inv-1", allocatedAmount: 70 },
            { invoiceId: "inv-2", allocatedAmount: 40 },
          ],
        },
        "u",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects with off-by-one-cent mismatch (Decimal-strict equality)", async () => {
    const service = makeService();
    await expect(
      service.create(
        "co",
        {
          ...baseDto,
          totalAmount: 100,
          allocations: [
            { invoiceId: "inv-1", allocatedAmount: 60 },
            { invoiceId: "inv-2", allocatedAmount: 39.99 },
          ],
        },
        "u",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
