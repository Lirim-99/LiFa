import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CreateAssetDto, RunDepreciationDto, UpdateAssetDto } from "./dto";
import { FixedAssetsService } from "./fixed-assets.service";

@Controller("fixed-assets")
@UseGuards(CompanyGuard)
export class FixedAssetsController {
  constructor(private readonly service: FixedAssetsService) {}

  @Get()
  @RequirePermission("accounting.read")
  list(@CurrentCompany("companyId") companyId: string, @Query("status") status?: string) {
    return this.service.list(companyId, status);
  }

  @Get(":id")
  @RequirePermission("accounting.read")
  get(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.get(companyId, id);
  }

  @Post()
  @RequirePermission("accounting.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateAssetDto,
  ) {
    return this.service.create(companyId, userId, dto);
  }

  @Patch(":id")
  @RequirePermission("accounting.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Post("depreciate")
  @RequirePermission("accounting.create")
  depreciate(@CurrentCompany("companyId") companyId: string, @Body() dto: RunDepreciationDto) {
    return this.service.runDepreciation(companyId, dto);
  }

  @Post(":id/dispose")
  @RequirePermission("accounting.update")
  dispose(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { disposalDate: string; disposalAmount: number },
  ) {
    return this.service.dispose(companyId, id, body.disposalDate, body.disposalAmount);
  }
}
