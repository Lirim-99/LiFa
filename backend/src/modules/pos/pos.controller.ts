import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { CloseSessionDto, CreateRegisterDto, CreateSaleDto, OpenSessionDto } from "./dto";
import { PosService } from "./pos.service";

@Controller("pos")
@UseGuards(CompanyGuard)
export class PosController {
  constructor(private readonly pos: PosService) {}

  // =================== Registers ===================

  @Get("registers")
  @RequirePermission("pos.read")
  listRegisters(@CurrentCompany("companyId") companyId: string) {
    return this.pos.listRegisters(companyId);
  }

  @Post("registers")
  @RequirePermission("pos.manage")
  createRegister(@CurrentCompany("companyId") companyId: string, @Body() dto: CreateRegisterDto) {
    return this.pos.createRegister(companyId, dto);
  }

  // =================== Sessions ===================

  @Get("sessions/current")
  @RequirePermission("pos.read")
  getCurrentSession(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
  ) {
    return this.pos.getOpenSession(companyId, userId);
  }

  @Post("sessions/open")
  @RequirePermission("pos.manage")
  openSession(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: OpenSessionDto,
  ) {
    return this.pos.openSession(companyId, userId, dto);
  }

  @Post("sessions/:id/close")
  @RequirePermission("pos.manage")
  closeSession(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CloseSessionDto,
  ) {
    return this.pos.closeSession(companyId, id, userId, dto);
  }

  @Get("sessions/:id/summary")
  @RequirePermission("pos.read")
  sessionSummary(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.pos.getSessionSummary(companyId, id);
  }

  @Get("sessions/:id/sales")
  @RequirePermission("pos.read")
  sessionSales(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.pos.listSessionSales(companyId, id);
  }

  // =================== Sales ===================

  @Post("sales")
  @RequirePermission("pos.sell")
  createSale(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateSaleDto,
  ) {
    return this.pos.createSale(companyId, userId, dto);
  }

  @Get("sales/:id")
  @RequirePermission("pos.read")
  getSale(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.pos.getSale(companyId, id);
  }

  // =================== Product Search ===================

  @Get("products")
  @RequirePermission("pos.read")
  searchProducts(
    @CurrentCompany("companyId") companyId: string,
    @Query("q") query: string,
  ) {
    return this.pos.searchProducts(companyId, query ?? "");
  }
}
