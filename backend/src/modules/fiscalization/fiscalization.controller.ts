import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { RecordManualCouponDto, UpsertFiscalConfigDto } from "./dto";
import { FiscalizationService } from "./fiscalization.service";

@Controller("fiscalization")
@UseGuards(CompanyGuard)
export class FiscalizationController {
  constructor(private readonly fiscalization: FiscalizationService) {}

  @Get("config")
  @RequirePermission("fiscalization.read")
  getConfig(@CurrentCompany("companyId") companyId: string) {
    return this.fiscalization.getConfig(companyId);
  }

  @Put("config")
  @RequirePermission("fiscalization.manage")
  upsertConfig(@CurrentCompany("companyId") companyId: string, @Body() dto: UpsertFiscalConfigDto) {
    return this.fiscalization.upsertConfig(companyId, dto);
  }

  @Get("invoices/:id/coupon")
  @RequirePermission("fiscalization.read")
  getCoupon(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.fiscalization.getCouponForInvoice(companyId, id);
  }

  @Post("invoices/:id/fiscalize")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("fiscalization.fiscalize")
  fiscalize(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.fiscalization.fiscalizeInvoice(companyId, id, userId);
  }

  @Post("invoices/:id/coupon/manual")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("fiscalization.fiscalize")
  recordManual(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: RecordManualCouponDto,
  ) {
    return this.fiscalization.recordManualCoupon(companyId, id, dto, userId);
  }
}
