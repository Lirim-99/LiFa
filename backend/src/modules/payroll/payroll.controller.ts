import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CreateEmployeeDto, CreatePayrollRunDto, UpdateEmployeeDto } from "./dto";
import { PayrollService } from "./payroll.service";

@Controller("payroll")
@UseGuards(CompanyGuard)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  // =================== Employees ===================

  @Get("employees")
  @RequirePermission("payroll.read")
  listEmployees(
    @CurrentCompany("companyId") companyId: string,
    @Query("all") all?: string,
  ) {
    return this.payroll.listEmployees(companyId, all !== "true");
  }

  @Get("employees/:id")
  @RequirePermission("payroll.read")
  getEmployee(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.payroll.getEmployee(companyId, id);
  }

  @Post("employees")
  @RequirePermission("payroll.manage")
  createEmployee(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.payroll.createEmployee(companyId, userId, dto);
  }

  @Patch("employees/:id")
  @RequirePermission("payroll.manage")
  updateEmployee(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.payroll.updateEmployee(companyId, id, dto);
  }

  // =================== Payroll Runs ===================

  @Get("runs")
  @RequirePermission("payroll.read")
  listRuns(@CurrentCompany("companyId") companyId: string) {
    return this.payroll.listRuns(companyId);
  }

  @Get("runs/:id")
  @RequirePermission("payroll.read")
  getRun(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.payroll.getRun(companyId, id);
  }

  @Post("runs")
  @RequirePermission("payroll.manage")
  createRun(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreatePayrollRunDto,
  ) {
    return this.payroll.createRun(companyId, userId, dto);
  }

  @Post("runs/:id/approve")
  @RequirePermission("payroll.manage")
  approveRun(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.payroll.approveRun(companyId, id);
  }

  @Post("runs/:id/mark-paid")
  @RequirePermission("payroll.manage")
  markPaid(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.payroll.markPaid(companyId, id);
  }
}
