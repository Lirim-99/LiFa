import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { paginatedResponse, type PaginatedResponse } from "../../common/dto/paginated-response.dto";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateStockMovementDto,
  CreateWarehouseDto,
  MovementFilterDto,
  StockLevelFilterDto,
  UpdateWarehouseDto,
} from "./dto";

const INBOUND_TYPES: StockMovementType[] = [
  "GOODS_RECEIPT",
  "TRANSFER_IN",
  "ADJUSTMENT_IN",
  "RETURN_IN",
];

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================
  // Warehouses
  // ===================================================================

  async findWarehouses(companyId: string) {
    return this.prisma.warehouse.findMany({
      where: { companyId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  async createWarehouse(companyId: string, userId: string, dto: CreateWarehouseDto) {
    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.warehouse.create({
      data: {
        companyId,
        createdBy: userId,
        code: dto.code,
        name: dto.name,
        address: dto.address,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateWarehouse(companyId: string, id: string, dto: UpdateWarehouseDto) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id, companyId } });
    if (!wh) throw new NotFoundException("Warehouse not found");

    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async deleteWarehouse(companyId: string, id: string) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id, companyId } });
    if (!wh) throw new NotFoundException("Warehouse not found");

    const movementCount = await this.prisma.stockMovement.count({ where: { warehouseId: id } });
    if (movementCount > 0) {
      throw new BadRequestException("Cannot delete warehouse with existing stock movements. Deactivate it instead.");
    }

    return this.prisma.warehouse.delete({ where: { id } });
  }

  // ===================================================================
  // Stock Movements
  // ===================================================================

  async findMovements(companyId: string, filters: MovementFilterDto): Promise<PaginatedResponse<unknown>> {
    const where: Prisma.StockMovementWhereInput = { companyId };
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.productServiceId) where.productServiceId = filters.productServiceId;
    if (filters.type) where.type = filters.type;
    if (filters.fromDate || filters.toDate) {
      where.movementDate = {};
      if (filters.fromDate) where.movementDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.movementDate.lte = new Date(filters.toDate);
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          productService: { select: { id: true, name: true, sku: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return paginatedResponse(items, total, page, limit);
  }

  async createMovement(companyId: string, userId: string, dto: CreateStockMovementDto) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, isActive: true },
    });
    if (!wh) throw new NotFoundException("Warehouse not found or inactive");

    const product = await this.prisma.productService.findFirst({
      where: { id: dto.productServiceId, companyId, type: "PRODUCT" },
    });
    if (!product) throw new BadRequestException("Item is not an inventory product");

    return this.prisma.stockMovement.create({
      data: {
        companyId,
        warehouseId: dto.warehouseId,
        productServiceId: dto.productServiceId,
        type: dto.type,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        reference: dto.reference,
        notes: dto.notes,
        movementDate: new Date(dto.movementDate),
        createdBy: userId,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        productService: { select: { id: true, name: true, sku: true } },
      },
    });
  }

  /**
   * Bulk-create stock movements from an issued document (invoice/bill).
   * Called by invoice/bill service post-commit.
   */
  async createDocumentMovements(
    companyId: string,
    userId: string,
    params: {
      documentType: string;
      documentId: string;
      reference: string;
      movementType: StockMovementType;
      movementDate: Date;
      lines: { productServiceId: string; quantity: number; unitCost?: number }[];
    },
  ) {
    const defaultWarehouse = await this.prisma.warehouse.findFirst({
      where: { companyId, isDefault: true, isActive: true },
    });
    if (!defaultWarehouse) return;

    const productIds = params.lines.map((l) => l.productServiceId);
    const products = await this.prisma.productService.findMany({
      where: { id: { in: productIds }, companyId, type: "PRODUCT" },
      select: { id: true },
    });
    const productIdSet = new Set(products.map((p) => p.id));

    const movementData = params.lines
      .filter((l) => productIdSet.has(l.productServiceId))
      .map((l) => ({
        companyId,
        warehouseId: defaultWarehouse.id,
        productServiceId: l.productServiceId,
        type: params.movementType,
        quantity: l.quantity,
        unitCost: l.unitCost,
        reference: params.reference,
        sourceDocumentId: params.documentId,
        sourceDocumentType: params.documentType,
        movementDate: params.movementDate,
        createdBy: userId,
      }));

    if (movementData.length === 0) return;
    await this.prisma.stockMovement.createMany({ data: movementData });
  }

  // ===================================================================
  // Stock Levels (computed from movements)
  // ===================================================================

  async getStockLevels(companyId: string, filters: StockLevelFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    const warehouseFilter = filters.warehouseId ? `AND sm."warehouse_id" = '${filters.warehouseId}'::uuid` : "";
    const productFilter = filters.productServiceId ? `AND sm."product_service_id" = '${filters.productServiceId}'::uuid` : "";

    const countQuery = Prisma.sql`
      SELECT COUNT(DISTINCT (sm."warehouse_id", sm."product_service_id"))::int as total
      FROM stock_movements sm
      WHERE sm."company_id" = ${companyId}::uuid
      ${Prisma.raw(warehouseFilter)}
      ${Prisma.raw(productFilter)}
    `;

    const dataQuery = Prisma.sql`
      SELECT
        sm."warehouse_id" as "warehouseId",
        w."code" as "warehouseCode",
        w."name" as "warehouseName",
        sm."product_service_id" as "productServiceId",
        ps."name" as "productName",
        ps."sku",
        ps."unit",
        SUM(CASE WHEN sm."type" IN ('GOODS_RECEIPT','TRANSFER_IN','ADJUSTMENT_IN','RETURN_IN')
            THEN sm."quantity" ELSE 0 END) -
        SUM(CASE WHEN sm."type" IN ('GOODS_ISSUE','TRANSFER_OUT','ADJUSTMENT_OUT','RETURN_OUT')
            THEN sm."quantity" ELSE 0 END) as "quantityOnHand",
        SUM(CASE WHEN sm."type" IN ('GOODS_RECEIPT','TRANSFER_IN','ADJUSTMENT_IN','RETURN_IN')
            THEN sm."quantity" ELSE 0 END) as "totalIn",
        SUM(CASE WHEN sm."type" IN ('GOODS_ISSUE','TRANSFER_OUT','ADJUSTMENT_OUT','RETURN_OUT')
            THEN sm."quantity" ELSE 0 END) as "totalOut"
      FROM stock_movements sm
      JOIN warehouses w ON w."id" = sm."warehouse_id"
      JOIN products_services ps ON ps."id" = sm."product_service_id"
      WHERE sm."company_id" = ${companyId}::uuid
      ${Prisma.raw(warehouseFilter)}
      ${Prisma.raw(productFilter)}
      GROUP BY sm."warehouse_id", w."code", w."name", sm."product_service_id", ps."name", ps."sku", ps."unit"
      ORDER BY ps."name", w."code"
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const [countResult, data] = await Promise.all([
      this.prisma.$queryRaw<[{ total: number }]>(countQuery),
      this.prisma.$queryRaw<StockLevelRow[]>(dataQuery),
    ]);

    const total = countResult[0]?.total ?? 0;
    return paginatedResponse(
      data.map((row) => ({
        ...row,
        quantityOnHand: Number(row.quantityOnHand),
        totalIn: Number(row.totalIn),
        totalOut: Number(row.totalOut),
      })),
      total,
      page,
      limit,
    );
  }

  /** Check if a product is in stock for a given quantity. */
  async isInStock(companyId: string, productServiceId: string, quantity: number): Promise<boolean> {
    const result = await this.prisma.$queryRaw<[{ balance: number }]>(Prisma.sql`
      SELECT
        COALESCE(
          SUM(CASE WHEN "type" IN ('GOODS_RECEIPT','TRANSFER_IN','ADJUSTMENT_IN','RETURN_IN')
              THEN "quantity" ELSE 0 END) -
          SUM(CASE WHEN "type" IN ('GOODS_ISSUE','TRANSFER_OUT','ADJUSTMENT_OUT','RETURN_OUT')
              THEN "quantity" ELSE 0 END),
          0
        )::decimal as balance
      FROM stock_movements
      WHERE "company_id" = ${companyId}::uuid
        AND "product_service_id" = ${productServiceId}::uuid
    `);
    return Number(result[0]?.balance ?? 0) >= quantity;
  }
}

interface StockLevelRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productServiceId: string;
  productName: string;
  sku: string | null;
  unit: string | null;
  quantityOnHand: number | string;
  totalIn: number | string;
  totalOut: number | string;
}
