import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
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
  constructor(private readonly prisma: PrismaService) {}

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

  async approveRun(companyId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id, companyId } });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "DRAFT") throw new BadRequestException("Payroll run is not in DRAFT status");

    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: "APPROVED" },
      include: { payslips: { include: { employee: true } } },
    });
  }

  async markPaid(companyId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id, companyId } });
    if (!run) throw new NotFoundException("Payroll run not found");
    if (run.status !== "APPROVED") throw new BadRequestException("Payroll run must be APPROVED to mark as paid");

    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: "PAID" },
      include: { payslips: { include: { employee: true } } },
    });
  }
}
