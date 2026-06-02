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
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { InvoiceFilterDto } from "./dto/invoice-filter.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@UseGuards(CompanyGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("invoices.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoices.create(companyId, dto, userId);
  }

  @Get()
  @RequirePermission("invoices.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: InvoiceFilterDto) {
    return this.invoices.findAll(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("invoices.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.findById(companyId, id);
  }

  @Patch(":id")
  @RequirePermission("invoices.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoices.update(companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("invoices.delete")
  async delete(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.invoices.delete(companyId, id);
  }

  @Post(":id/issue")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("invoices.issue")
  issue(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.invoices.issue(companyId, id, userId);
  }

  @Post(":id/void")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("invoices.void")
  void(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.invoices.void(companyId, id, userId);
  }
}
