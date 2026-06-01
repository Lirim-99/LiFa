import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates 12 monthly periods for `fiscalYear` based on the company's
   * `fiscal_year_start_month`. Safe to call multiple times — throws if any
   * periods for that year already exist (use `findAll` to check first).
   */
  async generate(companyId: string, fiscalYear: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { fiscalYearStartMonth: true },
    });
    if (!company) throw new NotFoundException("Company not found");

    const existing = await this.prisma.accountingPeriod.findFirst({
      where: { companyId, fiscalYear },
    });
    if (existing) {
      throw new ConflictException(`Periods for fiscal year ${fiscalYear} already exist`);
    }

    const periods = buildMonthlyPeriods(fiscalYear, company.fiscalYearStartMonth).map((p, idx) => ({
      companyId,
      fiscalYear,
      periodNumber: idx + 1,
      startDate: p.startDate,
      endDate: p.endDate,
    }));

    return this.prisma.$transaction(
      periods.map((p) => this.prisma.accountingPeriod.create({ data: p })),
    );
  }

  findAll(companyId: string, fiscalYear?: number) {
    return this.prisma.accountingPeriod.findMany({
      where: { companyId, ...(fiscalYear ? { fiscalYear } : {}) },
      orderBy: [{ fiscalYear: "asc" }, { periodNumber: "asc" }],
    });
  }

  /** The period whose [start_date, end_date] interval contains `date`. */
  async findForDate(companyId: string, date: Date) {
    return this.prisma.accountingPeriod.findFirst({
      where: { companyId, startDate: { lte: date }, endDate: { gte: date } },
    });
  }

  /** Close a period. Refuses if any DRAFT journal entries are still in it. */
  async close(companyId: string, periodId: string, userId: string) {
    const period = await this.assertOwnedPeriod(companyId, periodId);
    if (period.status === "CLOSED") {
      throw new BadRequestException("Period is already closed");
    }
    const draftCount = await this.prisma.journalEntry.count({
      where: { companyId, periodId, status: "DRAFT" },
    });
    if (draftCount > 0) {
      throw new BadRequestException(
        `Cannot close period: ${draftCount} draft journal entries remain in it.`,
      );
    }
    return this.prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: "CLOSED", closedAt: new Date(), closedBy: userId },
    });
  }

  /** Reopen a closed period. Owner/admin role check is enforced via @RequirePermission upstream. */
  async reopen(companyId: string, periodId: string) {
    const period = await this.assertOwnedPeriod(companyId, periodId);
    if (period.status === "OPEN") {
      throw new BadRequestException("Period is already open");
    }
    return this.prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: "OPEN", closedAt: null, closedBy: null },
    });
  }

  private async assertOwnedPeriod(companyId: string, id: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, companyId },
    });
    if (!period) throw new NotFoundException("Accounting period not found");
    return period;
  }
}

/**
 * Pure date math. Exported for tests and for CompanySetupService.
 * Returns 12 contiguous monthly periods starting at `startMonth` of the year
 * conventionally labelled `fiscalYear`. Honors non-January fiscal years
 * (e.g., startMonth=7 → FY2026 runs 2026-07-01 .. 2027-06-30).
 */
export function buildMonthlyPeriods(
  fiscalYear: number,
  startMonth: number,
): { startDate: Date; endDate: Date }[] {
  const periods: { startDate: Date; endDate: Date }[] = [];
  for (let i = 0; i < 12; i++) {
    const m0 = startMonth - 1 + i; // zero-indexed month offset from Jan
    const calendarYear = fiscalYear + Math.floor(m0 / 12);
    const month = m0 % 12; // 0..11
    const startDate = new Date(Date.UTC(calendarYear, month, 1));
    // Last day of the month: day 0 of the NEXT month.
    const endDate = new Date(Date.UTC(calendarYear, month + 1, 0));
    periods.push({ startDate, endDate });
  }
  return periods;
}
