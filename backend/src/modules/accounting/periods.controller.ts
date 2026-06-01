import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { GeneratePeriodsDto } from "./dto/generate-periods.dto";
import { PeriodsService } from "./periods.service";

@Controller("accounting-periods")
@UseGuards(CompanyGuard)
export class PeriodsController {
  constructor(private readonly periods: PeriodsService) {}

  @Post("generate")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("accounting.create")
  generate(@CurrentCompany("companyId") companyId: string, @Body() dto: GeneratePeriodsDto) {
    return this.periods.generate(companyId, dto.fiscalYear);
  }

  @Get()
  @RequirePermission("accounting.read")
  list(
    @CurrentCompany("companyId") companyId: string,
    @Query("fiscalYear") fiscalYearParam?: string,
  ) {
    const fiscalYear = fiscalYearParam ? parseInt(fiscalYearParam, 10) : undefined;
    return this.periods.findAll(companyId, fiscalYear);
  }

  @Patch(":id/close")
  @RequirePermission("accounting.update")
  close(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.periods.close(companyId, id, userId);
  }

  @Patch(":id/reopen")
  // Reopening a closed period is owner/admin-only — accountants get the broader
  // accounting.* wildcard, so we use the narrower company.update gate here.
  @RequirePermission("company.update")
  reopen(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.periods.reopen(companyId, id);
  }
}
