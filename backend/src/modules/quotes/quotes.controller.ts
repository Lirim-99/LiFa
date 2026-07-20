import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CreateQuoteDto, CreateSalesOrderDto, OrderFilterDto, QuoteFilterDto, UpdateQuoteDto, UpdateSalesOrderDto } from "./dto";
import { QuotesService } from "./quotes.service";

@Controller("quotes")
@UseGuards(CompanyGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  // =================== Quotes ===================

  @Get()
  @RequirePermission("quotes.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: QuoteFilterDto) {
    return this.quotesService.listQuotes(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("quotes.read")
  get(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.getQuote(companyId, id);
  }

  @Post()
  @RequirePermission("quotes.manage")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotesService.createQuote(companyId, userId, dto);
  }

  @Patch(":id")
  @RequirePermission("quotes.manage")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.quotesService.updateQuote(companyId, id, dto);
  }

  @Post(":id/send")
  @RequirePermission("quotes.manage")
  send(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.sendQuote(companyId, id);
  }

  @Post(":id/accept")
  @RequirePermission("quotes.manage")
  accept(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.acceptQuote(companyId, id);
  }

  @Post(":id/reject")
  @RequirePermission("quotes.manage")
  reject(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.rejectQuote(companyId, id);
  }

  @Post(":id/convert-to-order")
  @RequirePermission("quotes.manage")
  convertToOrder(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.quotesService.convertQuoteToOrder(companyId, id, userId);
  }
}

@Controller("sales-orders")
@UseGuards(CompanyGuard)
export class SalesOrdersController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  @RequirePermission("quotes.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: OrderFilterDto) {
    return this.quotesService.listOrders(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("quotes.read")
  get(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.getOrder(companyId, id);
  }

  @Post()
  @RequirePermission("quotes.manage")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateSalesOrderDto,
  ) {
    return this.quotesService.createOrder(companyId, userId, dto);
  }

  @Post(":id/confirm")
  @RequirePermission("quotes.manage")
  confirm(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.confirmOrder(companyId, id);
  }

  @Post(":id/cancel")
  @RequirePermission("quotes.manage")
  cancel(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.quotesService.cancelOrder(companyId, id);
  }
}
