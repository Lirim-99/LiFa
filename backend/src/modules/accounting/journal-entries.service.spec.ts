import { BadRequestException } from "@nestjs/common";
import { JournalEntriesService } from "./journal-entries.service";

/**
 * Service unit tests focused on the validation rules. Transactional concurrency
 * and the actual SELECT FOR UPDATE behaviour of DocumentSequenceService are
 * covered by e2e tests against Postgres (planned in a later step).
 */

type AccountRow = {
  id: string;
  companyId: string;
  code: string;
  isPostable: boolean;
  isActive: boolean;
};

function makePrisma() {
  const accounts: AccountRow[] = [];
  const prisma = {
    account: {
      findMany: ({ where }: { where: { id: { in: string[] }; companyId: string } }) =>
        Promise.resolve(
          accounts.filter((a) => where.id.in.includes(a.id) && a.companyId === where.companyId),
        ),
    },
    journalEntry: { create: jest.fn() },
  };
  return { prisma, accounts };
}

function makeService(opts: { postable?: boolean } = {}) {
  const { prisma, accounts } = makePrisma();
  const seq = { nextNumber: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new JournalEntriesService(prisma as never, seq as never, audit as never);
  return {
    service,
    prisma,
    accounts,
    addAccount: (id: string, companyId: string, code = "1000") =>
      accounts.push({
        id,
        companyId,
        code,
        isPostable: opts.postable ?? true,
        isActive: true,
      }),
  };
}

describe("JournalEntriesService.create — line-shape validation", () => {
  const companyId = "co-1";
  const userId = "u-1";

  it("rejects a line with both debit AND credit > 0", async () => {
    const { service, addAccount } = makeService();
    addAccount("a-1", companyId);
    addAccount("a-2", companyId);
    await expect(
      service.create(
        companyId,
        {
          entryDate: new Date(),
          lines: [
            { accountId: "a-1", debitAmount: 100, creditAmount: 100 },
            { accountId: "a-2", debitAmount: 0, creditAmount: 100 },
          ],
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a line with neither debit NOR credit > 0", async () => {
    const { service, addAccount } = makeService();
    addAccount("a-1", companyId);
    addAccount("a-2", companyId);
    await expect(
      service.create(
        companyId,
        {
          entryDate: new Date(),
          lines: [
            { accountId: "a-1", debitAmount: 0, creditAmount: 0 },
            { accountId: "a-2", debitAmount: 100, creditAmount: 0 },
          ],
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when an account isn't postable", async () => {
    const { service, addAccount } = makeService({ postable: false });
    addAccount("a-1", companyId);
    addAccount("a-2", companyId);
    await expect(
      service.create(
        companyId,
        {
          entryDate: new Date(),
          lines: [
            { accountId: "a-1", debitAmount: 100, creditAmount: 0 },
            { accountId: "a-2", debitAmount: 0, creditAmount: 100 },
          ],
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when an account doesn't exist in the company", async () => {
    const { service, addAccount } = makeService();
    addAccount("a-1", companyId);
    // No a-2 added → not found
    await expect(
      service.create(
        companyId,
        {
          entryDate: new Date(),
          lines: [
            { accountId: "a-1", debitAmount: 100, creditAmount: 0 },
            { accountId: "a-ghost", debitAmount: 0, creditAmount: 100 },
          ],
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
