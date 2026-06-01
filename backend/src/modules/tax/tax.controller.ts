import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CreateTaxRateDto } from "./dto/create-tax-rate.dto";
import { UpdateTaxRateDto } from "./dto/update-tax-rate.dto";
import { TaxService } from "./tax.service";

@Controller("tax-rates")
@UseGuards(CompanyGuard)
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("tax.create")
  create(@CurrentCompany("companyId") companyId: string, @Body() dto: CreateTaxRateDto) {
    return this.tax.create(companyId, dto);
  }

  @Get()
  @RequirePermission("tax.read")
  list(@CurrentCompany("companyId") companyId: string) {
    return this.tax.findAll(companyId);
  }

  @Get(":id")
  @RequirePermission("tax.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.tax.findById(companyId, id);
  }

  @Patch(":id")
  @RequirePermission("tax.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.tax.update(companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("tax.delete")
  async deactivate(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.tax.deactivate(companyId, id);
  }
}
