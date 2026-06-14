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
import { BillsService } from "./bills.service";
import { BillFilterDto } from "./dto/bill-filter.dto";
import { CreateBillDto } from "./dto/create-bill.dto";
import { UpdateBillDto } from "./dto/update-bill.dto";

@Controller("bills")
@UseGuards(CompanyGuard)
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("bills.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateBillDto,
  ) {
    return this.bills.create(companyId, dto, userId);
  }

  @Get()
  @RequirePermission("bills.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: BillFilterDto) {
    return this.bills.findAll(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("bills.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.bills.findById(companyId, id);
  }

  @Patch(":id")
  @RequirePermission("bills.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateBillDto,
  ) {
    return this.bills.update(companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("bills.delete")
  async delete(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.bills.delete(companyId, id);
  }

  @Post(":id/post")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("bills.post")
  post(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.bills.post(companyId, id, userId);
  }

  @Post(":id/void")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("bills.void")
  void(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.bills.void(companyId, id, userId);
  }
}
