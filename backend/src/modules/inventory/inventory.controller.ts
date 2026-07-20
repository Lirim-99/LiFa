import {
  Body,
  Controller,
  Delete,
  Get,
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
import {
  CreateStockMovementDto,
  CreateWarehouseDto,
  MovementFilterDto,
  StockLevelFilterDto,
  UpdateWarehouseDto,
} from "./dto";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
@UseGuards(CompanyGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // =================== Warehouses ===================

  @Get("warehouses")
  @RequirePermission("inventory.read")
  listWarehouses(@CurrentCompany("companyId") companyId: string) {
    return this.inventory.findWarehouses(companyId);
  }

  @Post("warehouses")
  @RequirePermission("inventory.manage")
  createWarehouse(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.inventory.createWarehouse(companyId, userId, dto);
  }

  @Patch("warehouses/:id")
  @RequirePermission("inventory.manage")
  updateWarehouse(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.inventory.updateWarehouse(companyId, id, dto);
  }

  @Delete("warehouses/:id")
  @RequirePermission("inventory.manage")
  deleteWarehouse(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.inventory.deleteWarehouse(companyId, id);
  }

  // =================== Stock Movements ===================

  @Get("movements")
  @RequirePermission("inventory.read")
  listMovements(
    @CurrentCompany("companyId") companyId: string,
    @Query() filters: MovementFilterDto,
  ) {
    return this.inventory.findMovements(companyId, filters);
  }

  @Post("movements")
  @RequirePermission("inventory.manage")
  createMovement(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.inventory.createMovement(companyId, userId, dto);
  }

  // =================== Stock Levels ===================

  @Get("stock-levels")
  @RequirePermission("inventory.read")
  stockLevels(
    @CurrentCompany("companyId") companyId: string,
    @Query() filters: StockLevelFilterDto,
  ) {
    return this.inventory.getStockLevels(companyId, filters);
  }
}
