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
import { CatalogService } from "./catalog.service";
import { CreateProductServiceDto } from "./dto/create-product-service.dto";
import { ProductServiceFilterDto } from "./dto/product-service-filter.dto";
import { UpdateProductServiceDto } from "./dto/update-product-service.dto";

@Controller("products-services")
@UseGuards(CompanyGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("catalog.create")
  create(
    @CurrentCompany("companyId") companyId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreateProductServiceDto,
  ) {
    return this.catalog.create(companyId, dto, userId);
  }

  @Get()
  @RequirePermission("catalog.read")
  list(@CurrentCompany("companyId") companyId: string, @Query() filters: ProductServiceFilterDto) {
    return this.catalog.findAll(companyId, filters);
  }

  @Get(":id")
  @RequirePermission("catalog.read")
  findOne(@CurrentCompany("companyId") companyId: string, @Param("id", ParseUUIDPipe) id: string) {
    return this.catalog.findById(companyId, id);
  }

  @Patch(":id")
  @RequirePermission("catalog.update")
  update(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductServiceDto,
  ) {
    return this.catalog.update(companyId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission("catalog.delete")
  async deactivate(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.catalog.deactivate(companyId, id);
  }
}
