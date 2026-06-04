import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import {
  ArAgingQueryDto,
  AsOfQueryDto,
  DateRangeQueryDto,
  GeneralLedgerQueryDto,
} from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(CompanyGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("trial-balance")
  @RequirePermission("reports.read")
  trialBalance(@CurrentCompany("companyId") companyId: string, @Query() q: DateRangeQueryDto) {
    return this.reports.trialBalance(companyId, q.from, q.to);
  }

  @Get("general-ledger")
  @RequirePermission("reports.read")
  generalLedger(@CurrentCompany("companyId") companyId: string, @Query() q: GeneralLedgerQueryDto) {
    return this.reports.generalLedger(companyId, q.accountId, q.from, q.to);
  }

  @Get("profit-and-loss")
  @RequirePermission("reports.read")
  profitAndLoss(@CurrentCompany("companyId") companyId: string, @Query() q: DateRangeQueryDto) {
    return this.reports.profitAndLoss(companyId, q.from, q.to);
  }

  @Get("balance-sheet")
  @RequirePermission("reports.read")
  balanceSheet(@CurrentCompany("companyId") companyId: string, @Query() q: AsOfQueryDto) {
    return this.reports.balanceSheet(companyId, q.asOf);
  }

  @Get("ar-aging")
  @RequirePermission("reports.read")
  arAging(@CurrentCompany("companyId") companyId: string, @Query() q: ArAgingQueryDto) {
    return this.reports.arAging(companyId, q.asOf ?? new Date());
  }
}
