import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { paginatedResponse, type PaginatedResponse } from "../../common/dto/paginated-response.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateProductServiceDto } from "./dto/create-product-service.dto";
import { ProductServiceFilterDto } from "./dto/product-service-filter.dto";
import { UpdateProductServiceDto } from "./dto/update-product-service.dto";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateProductServiceDto, userId: string) {
    await this.validateReferences(companyId, {
      incomeAccountId: dto.incomeAccountId,
      expenseAccountId: dto.expenseAccountId,
      defaultTaxRateId: dto.defaultTaxRateId,
    });
    return this.prisma.productService.create({
      data: {
        companyId,
        createdBy: userId,
        name: dto.name,
        type: dto.type,
        sku: dto.sku,
        description: dto.description,
        unit: dto.unit,
        salePrice: dto.salePrice,
        purchasePrice: dto.purchasePrice,
        incomeAccountId: dto.incomeAccountId,
        expenseAccountId: dto.expenseAccountId,
        defaultTaxRateId: dto.defaultTaxRateId,
      },
    });
  }

  async findAll(
    companyId: string,
    filters: ProductServiceFilterDto,
  ): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductServiceWhereInput = { companyId };
    if (filters.type !== undefined) where.type = filters.type;
    where.isActive = filters.isActive ?? true;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { sku: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const sortBy = filters.sortBy ?? "createdAt";
    const sortOrder = filters.sortOrder ?? "desc";
    const orderBy = { [sortBy]: sortOrder } as Prisma.ProductServiceOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.prisma.productService.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.productService.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findById(companyId: string, id: string) {
    const item = await this.prisma.productService.findFirst({ where: { id, companyId } });
    if (!item) throw new NotFoundException("Product/Service not found");
    return item;
  }

  async update(companyId: string, id: string, dto: UpdateProductServiceDto) {
    await this.findById(companyId, id);
    await this.validateReferences(companyId, {
      incomeAccountId: dto.incomeAccountId ?? undefined,
      expenseAccountId: dto.expenseAccountId ?? undefined,
      defaultTaxRateId: dto.defaultTaxRateId ?? undefined,
    });
    return this.prisma.productService.update({
      where: { id },
      data: dto as Prisma.ProductServiceUpdateInput,
    });
  }

  async deactivate(companyId: string, id: string) {
    await this.findById(companyId, id);
    return this.prisma.productService.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Validates FK references all belong to the same company. Tax-rate templates
   * (companyId = NULL) are accepted in addition to company-scoped rates so a
   * freshly-seeded company can use the system VAT rates directly.
   */
  private async validateReferences(
    companyId: string,
    refs: {
      incomeAccountId?: string;
      expenseAccountId?: string;
      defaultTaxRateId?: string;
    },
  ): Promise<void> {
    if (refs.incomeAccountId) {
      const a = await this.prisma.account.findFirst({
        where: { id: refs.incomeAccountId, companyId },
      });
      if (!a) throw new BadRequestException("income_account_id not found in this company");
    }
    if (refs.expenseAccountId) {
      const a = await this.prisma.account.findFirst({
        where: { id: refs.expenseAccountId, companyId },
      });
      if (!a) throw new BadRequestException("expense_account_id not found in this company");
    }
    if (refs.defaultTaxRateId) {
      const t = await this.prisma.taxRate.findFirst({
        where: {
          id: refs.defaultTaxRateId,
          OR: [{ companyId }, { companyId: null }],
        },
      });
      if (!t) throw new BadRequestException("default_tax_rate_id not found");
    }
  }
}
