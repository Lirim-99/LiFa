import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountRole, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerPostingService } from "../accounting/ledger-posting.service";
import type { CreateEmployeeDto, CreatePayrollRunDto, UpdateEmployeeDto } from "./dto";

/**
 * Kosovo payroll tax constants (2024/2025):
 * - Pension contribution employee: 5%
 * - Pension contribution employer: 5%
 * - Income tax brackets:
 *   0 - 80 EUR/month: 0%
 *   80 - 250 EUR/month: 4%
 *   250 - 450 EUR/month: 8%
 *   450+ EUR/month: 10%
 */
const PENSION_EMPLOYEE_RATE = 0.05;
const PENSION_EMPLOYER_RATE = 0.05;

/** Calendar date at UTC midnight so it still falls inside a period on its last day. */
function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function computeIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 80) return 0;
  let tax = 0;
  if (taxableIncome > 450) {
    tax += (taxableIncome - 450) * 0.1;
    tax += (450 - 250) * 0.08;
    tax += (250 - 80) * 0.04;
  } else if (taxableIncome > 250) {
    tax += (taxableIncome - 250) * 0.08;
    tax += (250 - 80) * 0.04;
  } else {
    tax += (taxableIncome - 80) * 0.04;
  }
  return Math.round(tax * 100) / 100;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerPostingService,
  ) {}

  // ===================================================================
  // Employees
  // ===================================================================

  async listEmployees(companyId: string, activeOnly = true) {
    return this.prisma.employee.findMany({
      where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

  async getEmployee(companyId: string, id: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, companyId } });
    if (!emp) throw new NotFoundException("Employee not found");
    return emp;
  }

  async createEmployee(companyId: string, userId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        companyId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        personalNumber: dto.personalNumber,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        department: dto.department,
        employmentType: dto.employmentType ?? "FULL_TIME",
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        grossSalary: dto.grossSalary,
        bankAccount: dto.bankAccount,
        createdBy: userId,
      },
    });
  }

  async updateEmployee(companyId: string, id: string, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.employee.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Employee not found");

    return this.prisma.employee.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        personalNumber: dto.personalNumber,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        department: dto.department,
        employmentType: dto.employmentType,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        grossSalary: dto.grossSalary,
        bankAccount: dto.bankAccount,
      },
    });
  }

  // ===================================================================
  // Payroll Runs
  // ===================================================================

  async listRuns(companyId: string) {
    return this.prisma.payrollRun.findMany({
      where: { companyId },
      orderBy: { periodStart: "desc" },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async getRun(companyId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: { payslips: { include: { employee: true } } },
    });
    if (!run) throw new NotFoundException("Payroll run not found");
    return run;
  }

  async createRun(companyId: string, userId: string, dto: CreatePayrollRunDto) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, isActive: true },
    });
    if (employees.length === 0) {
      throw new BadRequestException("No active employees to include in payroll run");
    }

    const adjustmentMap = new Map(
      (dto.adjustments ?? []).map((a) => [a.employeeId, a]),
    );

    let totalGross = new Prisma.Decimal(0);
    let totalNet = new Prisma.Decimal(0);
    let totalTax = new Prisma.Decimal(0);
    let totalPension = new Prisma.Decimal(0);

    const payslipData = employees.map((emp) => {
      const adj = adjustmentMap.get(emp.id);
      const gross = Number(emp.grossSalary);
      const overtimeHours = adj?.overtimeHours ?? 0;
      const hourlyRate = gross / 176; // ~22 working days * 8 hours
      const overtimeAmount = Math.round(overtimeHours * hourlyRate * 1.5 * 100) / 100;
      const bonus = adj?.bonusAmount ?? 0;
      const deduction = adj?.deductionAmount ?? 0;

      const totalEarnings = gross + overtimeAmount + bonus;
      const pensionEmployee = Math.round(totalEarnings * PENSION_EMPLOYEE_RATE * 100) / 100;
      const pensionEmployer = Math.round(totalEarnings * PENSION_EMPLOYER_RATE * 100) / 100;
      const taxableIncome = totalEarnings - pensionEmployee;
      const incomeTax = computeIncomeTax(taxableIncome);
      const netSalary = Math.round((totalEarnings - pensionEmployee - incomeTax - deduction) * 100) / 100;

      totalGross = totalGross.add(new Prisma.Decimal(totalEarnings));
      totalNet = totalNet.add(new Prisma.Decimal(netSalary));
      totalTax = totalTax.add(new Prisma.Decimal(incomeTax));
      totalPension = totalPension.add(new Prisma.Decimal(pensionEmployee + pensionEmployer));

      return {
        employeeId: emp.id,
        grossSalary: totalEarnings,
        pensionEmployee,
        pensionEmployer,
        incomeTax,
        netSalary,
        overtimeHours,
        overtimeAmount,
        bonusAmount: bonus,
        deductionAmount: deduction,
        deductionNotes: adj?.deductionNotes ?? null,
      };
    });

    return this.prisma.payrollRun.create({
      data: {
        companyId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        totalGross,
        totalNet,
        totalTax,
        totalPension,
        createdBy: userId,
        payslips: { create: payslipData },
      },
      include: { payslips: { include: { employee: true } } },
    });
  }

  async approveRun(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: { id, companyId },
        include: { payslips: true },
      });
      if (!run) throw new NotFoundException("Payroll run not found");
      if (run.status !== "DRAFT") throw new BadRequestException("Payroll run is not in DRAFT status");

      let gross = new Prisma.Decimal(0);
      let net = new Prisma.Decimal(0);
      let tax = new Prisma.Decimal(0);
      let employeePension = new Prisma.Decimal(0);
      let employerPension = new Prisma.Decimal(0);
      let deductions = new Prisma.Decimal(0);
      for (const slip of run.payslips) {
        gross = gross.plus(slip.grossSalary);
        net = net.plus(slip.netSalary);
        tax = tax.plus(slip.incomeTax);
        employeePension = employeePension.plus(slip.pensionEmployee);
        employerPension = employerPension.plus(slip.pensionEmployer);
        deductions = deductions.plus(slip.deductionAmount);
      }

      const salaries = gross.minus(deductions).plus(employerPension);
      const credits = net.plus(employeePension).plus(employerPension).plus(tax);
      const salariesDebit = salaries.plus(credits.minus(salaries));
      const pensionCredit = employeePension.plus(employerPension);

      const [salariesId, wagesId, pensionId, taxId] = await Promise.all([
        this.accountFor(tx, companyId, AccountRole.SALARIES),
        this.accountFor(tx, companyId, AccountRole.WAGES_PAYABLE),
        this.accountFor(tx, companyId, AccountRole.PENSION_PAYABLE),
        this.accountFor(tx, companyId, AccountRole.WAGE_TAX_PAYABLE),
      ]);

      const entry = await this.ledger.post(tx, {
        companyId,
        userId,
        entryDate: run.periodEnd,
        sourceDocumentType: "PAYROLL",
        sourceDocumentId: run.id,
        memo: `Payroll ${run.periodStart.toISOString().slice(0, 10)} – ${run.periodEnd.toISOString().slice(0, 10)}`,
        lines: [
          { accountId: salariesId, debit: salariesDebit, description: "Salaries and employer pension" },
          { accountId: wagesId, credit: net, description: "Net wages payable" },
          { accountId: pensionId, credit: pensionCredit, description: "Pension payable" },
          { accountId: taxId, credit: tax, description: "Wage tax payable" },
        ],
      });

      return tx.payrollRun.update({
        where: { id },
        data: { status: "APPROVED", accrualJournalEntryId: entry?.id },
        include: { payslips: { include: { employee: true } } },
      });
    });
  }

  async markPaid(companyId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findFirst({ where: { id, companyId } });
      if (!run) throw new NotFoundException("Payroll run not found");
      if (run.status !== "APPROVED") {
        throw new BadRequestException("Payroll run must be APPROVED to mark as paid");
      }

      const wagesId = await this.accountFor(tx, companyId, AccountRole.WAGES_PAYABLE);
      const bankId = await this.accountFor(tx, companyId, AccountRole.BANK);
      const entry = await this.ledger.post(tx, {
        companyId,
        userId,
        entryDate: utcToday(),
        sourceDocumentType: "PAYROLL_PAYMENT",
        sourceDocumentId: run.id,
        memo: "Payroll payment",
        lines: [
          { accountId: wagesId, debit: run.totalNet, description: "Net wages paid" },
          { accountId: bankId, credit: run.totalNet, description: "Bank" },
        ],
      });

      return tx.payrollRun.update({
        where: { id },
        data: { status: "PAID", paymentJournalEntryId: entry?.id },
        include: { payslips: { include: { employee: true } } },
      });
    });
  }

  private async accountFor(
    tx: Prisma.TransactionClient,
    companyId: string,
    role: AccountRole,
  ): Promise<string> {
    const row = await tx.companyAccountDefaults.findUnique({
      where: { companyId_accountRole: { companyId, accountRole: role } },
    });
    if (!row) {
      throw new BadRequestException(
        `Company account default not configured for role ${role}. Set it in company settings.`,
      );
    }
    return row.accountId;
  }
}
