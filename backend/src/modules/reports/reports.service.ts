import { Injectable, NotFoundException } from "@nestjs/common";
import { AccountType } from "@prisma/client";
import { DecimalUtil } from "../../common/utils/decimal.helper";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Read-only aggregations over POSTED journal_entry_lines and invoices. All
 * five reports run from the same primary sources, so they're tightly coupled
 * (no caching layer yet; add `use cache` or Redis later if needed).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================
  // Trial Balance — per-account debit/credit totals in [from, to]
  // ===================================================================

  async trialBalance(companyId: string, from: Date, to: Date) {
    const rows = await this.prisma.journalEntryLine.groupBy({
      by: ["accountId"],
      where: {
        journalEntry: {
          companyId,
          status: "POSTED",
          entryDate: { gte: from, lte: to },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const accountIds = rows.map((r) => r.accountId);
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        normalBalance: true,
      },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const lines = rows
      .map((r) => {
        const acc = accountMap.get(r.accountId);
        if (!acc) return null;
        const debit = r._sum.debitAmount ?? "0";
        const credit = r._sum.creditAmount ?? "0";
        return {
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          accountType: acc.accountType,
          normalBalance: acc.normalBalance,
          debit: DecimalUtil.toString(debit),
          credit: DecimalUtil.toString(credit),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((a, b) => a.code.localeCompare(b.code));

    const totalDebit = DecimalUtil.sum(lines.map((l) => l.debit));
    const totalCredit = DecimalUtil.sum(lines.map((l) => l.credit));
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      lines,
      totalDebit: DecimalUtil.toString(totalDebit),
      totalCredit: DecimalUtil.toString(totalCredit),
      balanced: DecimalUtil.isEqual(totalDebit, totalCredit),
    };
  }

  // ===================================================================
  // General Ledger — chronological lines for one account, running balance
  // ===================================================================

  async generalLedger(companyId: string, accountId: string, from: Date, to: Date) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId },
    });
    if (!account) throw new NotFoundException("Account not found");

    // Opening balance: sum of debits − credits BEFORE `from`. Sign depends on
    // the account's normal balance (debit-normal positive when debits > credits).
    const opening = await this.prisma.journalEntryLine.aggregate({
      where: {
        accountId,
        journalEntry: {
          companyId,
          status: "POSTED",
          entryDate: { lt: from },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });
    const openingDebit = opening._sum.debitAmount ?? "0";
    const openingCredit = opening._sum.creditAmount ?? "0";
    let runningBalance =
      account.normalBalance === "DEBIT"
        ? DecimalUtil.subtract(openingDebit, openingCredit)
        : DecimalUtil.subtract(openingCredit, openingDebit);
    const openingBalance = DecimalUtil.toString(runningBalance);

    const rows = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: {
          companyId,
          status: "POSTED",
          entryDate: { gte: from, lte: to },
        },
      },
      include: {
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            sourceDocumentType: true,
          },
        },
      },
      orderBy: [{ journalEntry: { entryDate: "asc" } }, { lineNumber: "asc" }],
    });

    const lines = rows.map((r) => {
      const delta =
        account.normalBalance === "DEBIT"
          ? DecimalUtil.subtract(r.debitAmount, r.creditAmount)
          : DecimalUtil.subtract(r.creditAmount, r.debitAmount);
      runningBalance = DecimalUtil.add(runningBalance, delta);
      return {
        entryId: r.journalEntry.id,
        entryNumber: r.journalEntry.entryNumber,
        entryDate: r.journalEntry.entryDate.toISOString().slice(0, 10),
        sourceDocumentType: r.journalEntry.sourceDocumentType,
        description: r.description,
        debit: DecimalUtil.toString(r.debitAmount),
        credit: DecimalUtil.toString(r.creditAmount),
        runningBalance: DecimalUtil.toString(runningBalance),
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
      },
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      openingBalance,
      lines,
      closingBalance: DecimalUtil.toString(runningBalance),
    };
  }

  // ===================================================================
  // P&L — revenue minus expenses over [from, to]
  // ===================================================================

  async profitAndLoss(companyId: string, from: Date, to: Date) {
    const revenue = await this.aggregateByAccount(companyId, from, to, "REVENUE");
    const expense = await this.aggregateByAccount(companyId, from, to, "EXPENSE");
    const totalRevenue = DecimalUtil.sum(revenue.map((r) => r.amount));
    const totalExpenses = DecimalUtil.sum(expense.map((r) => r.amount));
    const netIncome = DecimalUtil.subtract(totalRevenue, totalExpenses);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      revenue: revenue.map((r) => ({ ...r, amount: DecimalUtil.toString(r.amount) })),
      expenses: expense.map((r) => ({ ...r, amount: DecimalUtil.toString(r.amount) })),
      totalRevenue: DecimalUtil.toString(totalRevenue),
      totalExpenses: DecimalUtil.toString(totalExpenses),
      netIncome: DecimalUtil.toString(netIncome),
    };
  }

  // ===================================================================
  // Balance Sheet — assets / liabilities / equity AS OF `asOf`
  // ===================================================================

  async balanceSheet(companyId: string, asOf: Date) {
    // All time up to asOf — no `from`. Use a wide date floor.
    const epoch = new Date("1970-01-01");
    const [assets, liabilities, equity] = await Promise.all([
      this.aggregateByAccount(companyId, epoch, asOf, "ASSET"),
      this.aggregateByAccount(companyId, epoch, asOf, "LIABILITY"),
      this.aggregateByAccount(companyId, epoch, asOf, "EQUITY"),
    ]);
    // Retained earnings up to asOf = revenue − expenses (closed into equity).
    const revenue = await this.aggregateByAccount(companyId, epoch, asOf, "REVENUE");
    const expense = await this.aggregateByAccount(companyId, epoch, asOf, "EXPENSE");
    const retainedEarnings = DecimalUtil.subtract(
      DecimalUtil.sum(revenue.map((r) => r.amount)),
      DecimalUtil.sum(expense.map((r) => r.amount)),
    );

    const totalAssets = DecimalUtil.sum(assets.map((r) => r.amount));
    const totalLiabilities = DecimalUtil.sum(liabilities.map((r) => r.amount));
    const totalEquity = DecimalUtil.add(
      DecimalUtil.sum(equity.map((r) => r.amount)),
      retainedEarnings,
    );

    return {
      asOf: asOf.toISOString().slice(0, 10),
      assets: assets.map((r) => ({ ...r, amount: DecimalUtil.toString(r.amount) })),
      liabilities: liabilities.map((r) => ({ ...r, amount: DecimalUtil.toString(r.amount) })),
      equity: [
        ...equity.map((r) => ({ ...r, amount: DecimalUtil.toString(r.amount) })),
        {
          accountId: null,
          code: "—",
          name: "Retained earnings (period to date)",
          amount: DecimalUtil.toString(retainedEarnings),
        },
      ],
      totalAssets: DecimalUtil.toString(totalAssets),
      totalLiabilities: DecimalUtil.toString(totalLiabilities),
      totalEquity: DecimalUtil.toString(totalEquity),
      balanced: DecimalUtil.isEqual(totalAssets, DecimalUtil.add(totalLiabilities, totalEquity)),
    };
  }

  // ===================================================================
  // AR Aging — outstanding invoices bucketed by age, grouped by contact
  // ===================================================================

  async arAging(companyId: string, asOf: Date) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        totalAmount: true,
        balanceDue: true,
        contact: { select: { id: true, displayName: true } },
      },
    });

    type Bucket = "current" | "1-30" | "31-60" | "61-90" | "91+";
    const bucketize = (dueDate: Date): Bucket => {
      const diffDays = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return "current";
      if (diffDays <= 30) return "1-30";
      if (diffDays <= 60) return "31-60";
      if (diffDays <= 90) return "61-90";
      return "91+";
    };

    type ContactGroup = {
      contactId: string;
      contactName: string;
      current: string;
      "1-30": string;
      "31-60": string;
      "61-90": string;
      "91+": string;
      total: string;
      invoices: {
        invoiceNumber: string | null;
        dueDate: string;
        balanceDue: string;
        bucket: Bucket;
      }[];
    };

    const byContact = new Map<string, ContactGroup>();
    for (const inv of invoices) {
      if (DecimalUtil.isZero(inv.balanceDue)) continue;
      const bucket = bucketize(inv.dueDate);
      const cid = inv.contact.id;
      const group =
        byContact.get(cid) ??
        ({
          contactId: cid,
          contactName: inv.contact.displayName,
          current: "0",
          "1-30": "0",
          "31-60": "0",
          "61-90": "0",
          "91+": "0",
          total: "0",
          invoices: [],
        } as ContactGroup);
      group[bucket] = DecimalUtil.toString(DecimalUtil.add(group[bucket], inv.balanceDue));
      group.total = DecimalUtil.toString(DecimalUtil.add(group.total, inv.balanceDue));
      group.invoices.push({
        invoiceNumber: inv.invoiceNumber,
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        balanceDue: DecimalUtil.toString(inv.balanceDue),
        bucket,
      });
      byContact.set(cid, group);
    }

    const rows = Array.from(byContact.values()).sort((a, b) =>
      a.contactName.localeCompare(b.contactName),
    );
    const totals = rows.reduce(
      (acc, r) => {
        for (const b of ["current", "1-30", "31-60", "61-90", "91+"] as Bucket[]) {
          acc[b] = DecimalUtil.toString(DecimalUtil.add(acc[b], r[b]));
        }
        acc.total = DecimalUtil.toString(DecimalUtil.add(acc.total, r.total));
        return acc;
      },
      { current: "0", "1-30": "0", "31-60": "0", "61-90": "0", "91+": "0", total: "0" },
    );

    return {
      asOf: asOf.toISOString().slice(0, 10),
      rows,
      totals,
    };
  }

  // ===================================================================
  // Helper — per-account totals signed by the account's normal balance
  // ===================================================================

  private async aggregateByAccount(
    companyId: string,
    from: Date,
    to: Date,
    accountType: AccountType,
  ) {
    const rows = await this.prisma.journalEntryLine.groupBy({
      by: ["accountId"],
      where: {
        journalEntry: {
          companyId,
          status: "POSTED",
          entryDate: { gte: from, lte: to },
        },
        account: { accountType },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });
    const accountIds = rows.map((r) => r.accountId);
    if (accountIds.length === 0) return [];

    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, code: true, name: true, normalBalance: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    return rows
      .map((r) => {
        const acc = accountMap.get(r.accountId);
        if (!acc) return null;
        const debit = r._sum.debitAmount ?? "0";
        const credit = r._sum.creditAmount ?? "0";
        const amount =
          acc.normalBalance === "DEBIT"
            ? DecimalUtil.subtract(debit, credit)
            : DecimalUtil.subtract(credit, debit);
        return { accountId: acc.id, code: acc.code, name: acc.name, amount };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((a, b) => a.code.localeCompare(b.code));
  }
}
