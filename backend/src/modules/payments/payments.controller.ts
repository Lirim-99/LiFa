import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentFilterDto } from "./dto/payment-filter.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
@UseGuards(CompanyGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("payments.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.create(companyId, dto, userId);
  }

  @Get()
  @RequirePermission("payments.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: PaymentFilterDto) {
    return this.payments.findAll(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("payments.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.payments.findById(companyId, id);
  }

  @Post(":id/void")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("payments.void")
  void(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.payments.void(companyId, id, userId);
  }
}
