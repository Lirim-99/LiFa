import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentMethod, PosPaymentMethod, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { InvoicesService } from "../sales/invoices.service";
import type { CloseSessionDto, CreateRegisterDto, CreateSaleDto, OpenSessionDto } from "./dto";

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
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

    const today = new Date();
    const contactId = await this.getOrCreatePosContact(companyId, userId);
    const draft = await this.invoices.create(
      companyId,
      {
        contactId,
        issueDate: today,
        dueDate: today,
        currency: "EUR",
        notes: dto.customerName ? `POS — ${dto.customerName}` : "POS sale",
        lines: dto.lines.map((line) => {
          const product = productMap.get(line.productServiceId)!;
          return {
            productServiceId: line.productServiceId,
            description: product.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRateId: product.defaultTaxRate?.id,
          };
        }),
      },
      userId,
    );

    const total = new Prisma.Decimal(draft.totalAmount);
    if (new Prisma.Decimal(dto.amountPaid).lt(total)) {
      await this.invoices.delete(companyId, draft.id);
      throw new BadRequestException("Amount paid is less than the sale total");
    }

    let issued;
    try {
      issued = await this.invoices.issue(companyId, draft.id, userId);
    } catch (error) {
      await this.invoices.delete(companyId, draft.id);
      throw error;
    }

    const paymentMethod: PaymentMethod = dto.paymentMethod === "CASH" ? "CASH" : "BANK_TRANSFER";
    const paid = Number(issued.totalAmount);
    try {
      await this.payments.create(
        companyId,
        {
          contactId,
          paymentType: "RECEIVED",
          paymentMethod,
          paymentDate: issued.issueDate,
          totalAmount: paid,
          notes: "POS sale",
          allocations: [{ invoiceId: issued.id, allocatedAmount: paid }],
        },
        userId,
      );
    } catch (error) {
      await this.invoices.void(companyId, issued.id, userId);
      throw error;
    }

    const saleNumber = await this.getNextSaleNumber(dto.sessionId);
    const changeGiven = Math.max(0, dto.amountPaid - paid);
    return this.prisma.posSale.create({
      data: {
        companyId,
        sessionId: dto.sessionId,
        saleNumber,
        paymentMethod: dto.paymentMethod,
        subtotal: issued.subtotalAmount,
        taxAmount: issued.taxAmount,
        totalAmount: issued.totalAmount,
        amountPaid: dto.amountPaid,
        changeGiven,
        currency: "EUR",
        invoiceId: issued.id,
        customerName: dto.customerName,
        createdBy: userId,
        lines: {
          create: issued.lines.map((line) => ({
            lineNumber: line.lineNumber,
            productServiceId: line.productServiceId ?? dto.lines[0].productServiceId,
            name: line.description ?? "Item",
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxAmount: line.taxAmount,
            totalAmount: line.totalAmount,
          })),
        },
      },
      include: { lines: true },
    });
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
