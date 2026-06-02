import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { AuditService } from "./audit.service";
import { AuditFilterDto } from "./dto/audit-filter.dto";

@Controller("audit-logs")
@UseGuards(CompanyGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission("audit.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: AuditFilterDto) {
    return this.audit.findAll(companyId, filters);
  }
}
