import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { AccountRole } from "@prisma/client";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CompanyAccountDefaultsService } from "./company-account-defaults.service";
import { SetAccountDefaultDto } from "./dto/set-account-default.dto";

@Controller("company-account-defaults")
@UseGuards(CompanyGuard)
export class CompanyAccountDefaultsController {
  constructor(private readonly defaults: CompanyAccountDefaultsService) {}

  @Get()
  @RequirePermission("accounting.read")
  list(@CurrentCompany("companyId") companyId: string) {
    return this.defaults.getDefaults(companyId);
  }

  @Put(":role")
  @RequirePermission("accounting.update")
  set(
    @CurrentCompany("companyId") companyId: string,
    @Param("role") role: AccountRole,
    @Body() dto: SetAccountDefaultDto,
  ) {
    return this.defaults.setDefault(companyId, role, dto.accountId);
  }
}
