import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PosPaymentMethod, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { FiscalizationService } from "../fiscalization/fiscalization.service";
import { InventoryService } from "../inventory/inventory.service";
import type { CloseSessionDto, CreateRegisterDto, CreateSaleDto, OpenSessionDto } from "./dto";

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly fiscalization: FiscalizationService,
  ) {}

  // ===================================================================
  // Registers
  // ===================================================================

  async listRegisters(companyId: string) {
    return this.prisma.posRegister.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    });
  }

  async createRegister(companyId: string, dto: CreateRegisterDto) {
    return this.prisma.posRegister.create({
      data: { companyId, name: dto.name },
    });
  }

  // ===================================================================
  // Sessions
  // ===================================================================

  async getOpenSession(companyId: string, userId: string) {
    return this.prisma.posSession.findFirst({
      where: { companyId, openedBy: userId, status: "OPEN" },
      include: { register: true },
    });
  }

  async openSession(companyId: string, userId: string, dto: OpenSessionDto) {
    const existing = await this.prisma.posSession.findFirst({
      where: { companyId, openedBy: userId, status: "OPEN" },
    });
    if (existing) {
      throw new BadRequestException("You already have an open session. Close it first.");
    }

    const register = await this.prisma.posRegister.findFirst({
      where: { id: dto.registerId, companyId, isActive: true },
    });
    if (!register) throw new NotFoundException("Register not found or inactive");

    return this.prisma.posSession.create({
      data: {
        companyId,
        registerId: dto.registerId,
        openedBy: userId,
        openingBalance: dto.openingBalance,
      },
      include: { register: true },
    });
  }

  async closeSession(companyId: string, sessionId: string, userId: string, dto: CloseSessionDto) {
    const session = await this.prisma.posSession.findFirst({
      where: { id: sessionId, companyId, status: "OPEN" },
    });
    if (!session) throw new NotFoundException("Open session not found");

    const salesAgg = await this.prisma.posSale.aggregate({
      where: { sessionId, status: "COMPLETED", paymentMethod: PosPaymentMethod.CASH },
      _sum: { totalAmount: true, changeGiven: true },
    });

    const cashSales = Number(salesAgg._sum.totalAmount ?? 0) - Number(salesAgg._sum.changeGiven ?? 0);
    const expectedBalance = Number(session.openingBalance) + cashSales;

    return this.prisma.posSession.update({
      where: { id: sessionId },
      data: {
        status: "CLOSED",
        closedBy: userId,
        closedAt: new Date(),
        closingBalance: dto.closingBalance,
        expectedBalance,
      },
      include: { register: true },
    });
  }

  async getSessionSummary(companyId: string, sessionId: string) {
    const session = await this.prisma.posSession.findFirst({
      where: { id: sessionId, companyId },
      include: { register: true },
    });
    if (!session) throw new NotFoundException("Session not found");

    const salesCount = await this.prisma.posSale.count({
      where: { sessionId, status: "COMPLETED" },
    });
    const totals = await this.prisma.posSale.aggregate({
      where: { sessionId, status: "COMPLETED" },
      _sum: { totalAmount: true, taxAmount: true },
    });

    return {
      ...session,
      salesCount,
      totalRevenue: Number(totals._sum.totalAmount ?? 0),
      totalTax: Number(totals._sum.taxAmount ?? 0),
    };
  }

  // ===================================================================
  // Sales
  // ===================================================================

  async createSale(companyId: string, userId: string, dto: CreateSaleDto) {
    const session = await this.prisma.posSession.findFirst({
      where: { id: dto.sessionId, companyId, status: "OPEN" },
    });
    if (!session) throw new BadRequestException("No open session found");

    const productIds = dto.lines.map((l) => l.productServiceId);
    const products = await this.prisma.productService.findMany({
      where: { id: { in: productIds }, companyId, isActive: true },
      include: { defaultTaxRate: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const line of dto.lines) {
      if (!productMap.has(line.productServiceId)) {
        throw new BadRequestException(`Product ${line.productServiceId} not found or inactive`);
      }
    }

    const saleNumber = await this.getNextSaleNumber(dto.sessionId);

    let subtotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);

    const lineData = dto.lines.map((line, idx) => {
      const product = productMap.get(line.productServiceId)!;
      const lineTotal = new Prisma.Decimal(line.quantity).mul(new Prisma.Decimal(line.unitPrice));
      let lineTax = new Prisma.Decimal(0);

      if (product.defaultTaxRate) {
        const rate = product.defaultTaxRate.rate;
        if (product.defaultTaxRate.calculationType === "INCLUSIVE") {
          lineTax = lineTotal.sub(lineTotal.div(new Prisma.Decimal(1).add(rate.div(100))));
        } else {
          lineTax = lineTotal.mul(rate).div(100);
        }
      }

      subtotal = subtotal.add(lineTotal);
      taxTotal = taxTotal.add(lineTax);

      return {
        lineNumber: idx + 1,
        productServiceId: line.productServiceId,
        name: product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxAmount: lineTax,
        totalAmount: lineTotal.add(
          product.defaultTaxRate?.calculationType === "EXCLUSIVE" ? lineTax : new Prisma.Decimal(0),
        ),
      };
    });

    const totalAmount = subtotal.add(
      taxTotal.greaterThan(0) ? new Prisma.Decimal(0) : new Prisma.Decimal(0),
    );
    const finalTotal = lineData.reduce(
      (sum, l) => sum.add(l.totalAmount),
      new Prisma.Decimal(0),
    );
    const changeGiven = Math.max(0, dto.amountPaid - Number(finalTotal));

    const sale = await this.prisma.posSale.create({
      data: {
        companyId,
        sessionId: dto.sessionId,
        saleNumber,
        paymentMethod: dto.paymentMethod,
        subtotal,
        taxAmount: taxTotal,
        totalAmount: finalTotal,
        amountPaid: dto.amountPaid,
        changeGiven,
        customerName: dto.customerName,
        createdBy: userId,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    // Best-effort: create inventory movements for product lines
    try {
      await this.inventory.createDocumentMovements(companyId, userId, {
        documentType: "POS_SALE",
        documentId: sale.id,
        reference: `POS-${saleNumber}`,
        movementType: "GOODS_ISSUE",
        movementDate: new Date(),
        lines: dto.lines.map((l) => ({
          productServiceId: l.productServiceId,
          quantity: l.quantity,
          unitCost: l.unitPrice,
        })),
      });
    } catch (e) {
      this.logger.warn(`Failed to create inventory movements for POS sale ${sale.id}: ${e}`);
    }

    // Best-effort: create a fiscal invoice linked to this POS sale
    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          companyId,
          contactId: await this.getOrCreatePosContact(companyId, userId),
          issueDate: new Date(),
          dueDate: new Date(),
          currency: "EUR",
          subtotalAmount: sale.subtotal,
          taxAmount: sale.taxAmount,
          totalAmount: sale.totalAmount,
          paidAmount: sale.totalAmount,
          balanceDue: 0,
          status: "PAID",
          invoiceNumber: `POS-${saleNumber}`,
          notes: `POS Sale #${saleNumber}`,
          createdBy: userId,
          lines: {
            create: lineData.map((l) => ({
              lineNumber: l.lineNumber,
              description: l.name,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              taxAmount: l.taxAmount,
              totalAmount: l.totalAmount,
              productServiceId: l.productServiceId,
            })),
          },
        },
      });

      await this.prisma.posSale.update({
        where: { id: sale.id },
        data: { invoiceId: invoice.id },
      });

      // Trigger fiscalization
      await this.fiscalization.onInvoiceIssued(companyId, invoice.id);
    } catch (e) {
      this.logger.warn(`Failed to create fiscal invoice for POS sale ${sale.id}: ${e}`);
    }

    return sale;
  }

  async listSessionSales(companyId: string, sessionId: string) {
    return this.prisma.posSale.findMany({
      where: { sessionId, companyId },
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });
  }

  async getSale(companyId: string, saleId: string) {
    const sale = await this.prisma.posSale.findFirst({
      where: { id: saleId, companyId },
      include: { lines: true, session: { include: { register: true } } },
    });
    if (!sale) throw new NotFoundException("Sale not found");
    return sale;
  }

  // ===================================================================
  // Product search (quick POS search)
  // ===================================================================

  async searchProducts(companyId: string, query: string) {
    const q = query.trim();
    return this.prisma.productService.findMany({
      where: {
        companyId,
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      take: q ? 40 : 200,
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: { defaultTaxRate: true },
    });
  }

  // ===================================================================
  // Private helpers
  // ===================================================================

  private async getOrCreatePosContact(companyId: string, userId: string): Promise<string> {
    const existing = await this.prisma.contact.findFirst({
      where: { companyId, displayName: "POS Customer" },
    });
    if (existing) return existing.id;

    const contact = await this.prisma.contact.create({
      data: {
        companyId,
        displayName: "POS Customer",
        isCustomer: true,
        isVendor: false,
        createdBy: userId,
      },
    });
    return contact.id;
  }

  private async getNextSaleNumber(sessionId: string): Promise<number> {
    const last = await this.prisma.posSale.findFirst({
      where: { sessionId },
      orderBy: { saleNumber: "desc" },
      select: { saleNumber: true },
    });
    return (last?.saleNumber ?? 0) + 1;
  }
}
