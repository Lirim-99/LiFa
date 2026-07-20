import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { UpsertRateDto } from "./dto";
import { ExchangeRatesService } from "./exchange-rates.service";

@Controller("exchange-rates")
@UseGuards(CompanyGuard)
export class ExchangeRatesController {
  constructor(private readonly service: ExchangeRatesService) {}

  @Get()
  @RequirePermission("accounting.read")
  list(
    @CurrentCompany("companyId") companyId: string,
    @Query("currency") currency?: string,
  ) {
    return this.service.list(companyId, currency);
  }

  @Post()
  @RequirePermission("accounting.create")
  upsert(@CurrentCompany("companyId") companyId: string, @Body() dto: UpsertRateDto) {
    return this.service.upsert(companyId, dto);
  }

  @Delete(":id")
  @RequirePermission("accounting.delete")
  delete(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(companyId, id);
  }

  @Get("convert")
  @RequirePermission("accounting.read")
  async convert(
    @CurrentCompany("companyId") companyId: string,
    @Query("currency") currency: string,
    @Query("date") date: string,
  ) {
    const rate = await this.service.getRate(companyId, currency, new Date(date || Date.now()));
    return { currency, rate, date };
  }
}
