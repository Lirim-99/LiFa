import { Injectable } from "@nestjs/common";
import { AccountRole, Prisma } from "@prisma/client";
import {
  DEFAULT_ACCOUNT_ROLE_CODES,
  DEFAULT_CHART_OF_ACCOUNTS,
} from "../accounting/data/default-chart-of-accounts";
import { buildMonthlyPeriods } from "../accounting/periods.service";

/**
 * Seeds all reference data a new company needs to start operating:
 *   1. Per-company copies of system tax-rate templates (companyId = NULL).
 *   2. Default chart of accounts (with `isSystem` flags from the template).
 *   3. 12 accounting periods for the current fiscal year, all OPEN.
 *   4. CompanyAccountDefaults — maps account roles (AR / Cash / Bank /
 *      VAT Payable / Sales Revenue) to the seeded account rows by code.
 *
 * Runs inside the caller's Prisma transaction (CompaniesService.create) so
 * either every row exists or none of them do.
 */
@Injectable()
export class CompanySetupService {
  async seedDefaults(
    tx: Prisma.TransactionClient,
    args: {
      companyId: string;
      createdBy: string;
      fiscalYearStartMonth: number;
      fiscalYear: number;
    },
  ): Promise<void> {
    await this.seedTaxRates(tx, args.companyId);
    const accountsByCode = await this.seedChartOfAccounts(tx, args.companyId, args.createdBy);
    await this.seedPeriods(tx, args.companyId, args.fiscalYear, args.fiscalYearStartMonth);
    await this.seedAccountDefaults(tx, args.companyId, accountsByCode);
  }

  private async seedTaxRates(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
    const templates = await tx.taxRate.findMany({ where: { companyId: null } });
    if (templates.length === 0) return; // seed not run — nothing to copy

    await tx.taxRate.createMany({
      data: templates.map((t) => ({
        companyId,
        name: t.name,
        code: t.code,
        rate: t.rate,
        calculationType: t.calculationType,
        scope: t.scope,
        isDefault: t.isDefault,
      })),
    });
  }

  private async seedChartOfAccounts(
    tx: Prisma.TransactionClient,
    companyId: string,
    createdBy: string,
  ): Promise<Map<string, string>> {
    // Single createMany then re-read to get the assigned IDs — avoids a
    // sequential INSERT per row.
    await tx.account.createMany({
      data: DEFAULT_CHART_OF_ACCOUNTS.map((a) => ({
        companyId,
        createdBy,
        code: a.code,
        name: a.name,
        accountType: a.accountType,
        normalBalance: a.normalBalance,
        accountSubtype: a.accountSubtype,
        isSystem: a.isSystem ?? false,
      })),
    });
    const created = await tx.account.findMany({
      where: { companyId },
      select: { id: true, code: true },
    });
    return new Map(created.map((a) => [a.code, a.id]));
  }

  private async seedPeriods(
    tx: Prisma.TransactionClient,
    companyId: string,
    fiscalYear: number,
    startMonth: number,
  ): Promise<void> {
    const months = buildMonthlyPeriods(fiscalYear, startMonth);
    await tx.accountingPeriod.createMany({
      data: months.map((m, i) => ({
        companyId,
        fiscalYear,
        periodNumber: i + 1,
        startDate: m.startDate,
        endDate: m.endDate,
      })),
    });
  }

  private async seedAccountDefaults(
    tx: Prisma.TransactionClient,
    companyId: string,
    accountsByCode: Map<string, string>,
  ): Promise<void> {
    const rows: { companyId: string; accountRole: AccountRole; accountId: string }[] = [];
    for (const [role, code] of Object.entries(DEFAULT_ACCOUNT_ROLE_CODES) as [
      AccountRole,
      string,
    ][]) {
      const accountId = accountsByCode.get(code);
      if (!accountId) continue; // would be a CoA template bug — skip rather than crash
      rows.push({ companyId, accountRole: role, accountId });
    }
    if (rows.length > 0) {
      await tx.companyAccountDefaults.createMany({ data: rows });
    }
  }
}
