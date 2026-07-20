import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, QuoteStatus, SalesOrderStatus } from "@prisma/client";
import { paginatedResponse } from "../../common/dto/paginated-response.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { DocumentSequenceService } from "../../common/services/document-sequence.service";
import type { CreateQuoteDto, CreateSalesOrderDto, OrderFilterDto, QuoteFilterDto, UpdateQuoteDto, UpdateSalesOrderDto } from "./dto";

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
  ) {}

  // ===================================================================
  // Quotes
  // ===================================================================

  async listQuotes(companyId: string, filters: QuoteFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const where: Prisma.QuoteWhereInput = { companyId };
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { contact: { select: { id: true, displayName: true } }, lines: true },
      }),
      this.prisma.quote.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async getQuote(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId },
      include: { contact: true, lines: { orderBy: { lineNumber: "asc" } } },
    });
    if (!quote) throw new NotFoundException("Quote not found");
    return quote;
  }

  async createQuote(companyId: string, userId: string, dto: CreateQuoteDto) {
    const lineData = dto.lines.map((l, i) => {
      const lineTotal = l.quantity * l.unitPrice * (1 - (l.discountPercent ?? 0) / 100);
      return {
        lineNumber: i + 1,
        productServiceId: l.productServiceId ?? null,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent ?? 0,
        taxAmount: l.taxAmount ?? 0,
        totalAmount: lineTotal,
      };
    });

    const subtotal = lineData.reduce((s, l) => s + l.totalAmount, 0);
    const taxAmount = lineData.reduce((s, l) => s + l.taxAmount, 0);

    return this.prisma.quote.create({
      data: {
        companyId,
        contactId: dto.contactId,
        issueDate: new Date(dto.issueDate),
        expiryDate: new Date(dto.expiryDate),
        currency: dto.currency ?? "EUR",
        notes: dto.notes,
        subtotalAmount: subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        createdBy: userId,
        lines: { create: lineData },
      },
      include: { lines: true, contact: true },
    });
  }

  async updateQuote(companyId: string, id: string, dto: UpdateQuoteDto) {
    const existing = await this.prisma.quote.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Quote not found");
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Only DRAFT quotes can be edited");
    }

    const lineData = dto.lines.map((l, i) => {
      const lineTotal = l.quantity * l.unitPrice * (1 - (l.discountPercent ?? 0) / 100);
      return {
        lineNumber: i + 1,
        productServiceId: l.productServiceId ?? null,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent ?? 0,
        taxAmount: l.taxAmount ?? 0,
        totalAmount: lineTotal,
      };
    });

    const subtotal = lineData.reduce((s, l) => s + l.totalAmount, 0);
    const taxAmount = lineData.reduce((s, l) => s + l.taxAmount, 0);

    return this.prisma.$transaction(async (tx) => {
      await tx.quoteLine.deleteMany({ where: { quoteId: id } });
      return tx.quote.update({
        where: { id },
        data: {
          contactId: dto.contactId,
          issueDate: new Date(dto.issueDate),
          expiryDate: new Date(dto.expiryDate),
          currency: dto.currency ?? "EUR",
          notes: dto.notes,
          subtotalAmount: subtotal,
          taxAmount,
          totalAmount: subtotal + taxAmount,
          lines: { create: lineData },
        },
        include: { lines: true, contact: true },
      });
    });
  }

  async sendQuote(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, companyId } });
    if (!quote) throw new NotFoundException("Quote not found");
    if (quote.status !== "DRAFT") throw new BadRequestException("Quote already sent");

    return this.prisma.$transaction(async (tx) => {
      const num = await this.docSeq.nextNumber(tx, companyId, "QUOTE" as any, new Date().getFullYear());
      const quoteNumber = `QUO-${String(num).padStart(5, "0")}`;
      return tx.quote.update({
        where: { id },
        data: { status: QuoteStatus.SENT, quoteNumber },
        include: { lines: true, contact: true },
      });
    });
  }

  async acceptQuote(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, companyId } });
    if (!quote) throw new NotFoundException("Quote not found");
    if (quote.status !== "SENT") throw new BadRequestException("Quote must be SENT to accept");

    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.ACCEPTED },
      include: { lines: true, contact: true },
    });
  }

  async rejectQuote(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, companyId } });
    if (!quote) throw new NotFoundException("Quote not found");
    if (quote.status !== "SENT") throw new BadRequestException("Quote must be SENT to reject");

    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.REJECTED },
      include: { lines: true, contact: true },
    });
  }

  async convertQuoteToOrder(companyId: string, quoteId: string, userId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId },
      include: { lines: true },
    });
    if (!quote) throw new NotFoundException("Quote not found");
    if (quote.status !== "ACCEPTED") {
      throw new BadRequestException("Only ACCEPTED quotes can be converted to orders");
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const num = await this.docSeq.nextNumber(tx, companyId, "SALES_ORDER" as any, new Date().getFullYear());
      const orderNumber = `SO-${String(num).padStart(5, "0")}`;
      const created = await tx.salesOrder.create({
        data: {
          companyId,
          orderNumber,
          contactId: quote.contactId,
          orderDate: new Date(),
          currency: quote.currency,
          subtotalAmount: quote.subtotalAmount,
          taxAmount: quote.taxAmount,
          totalAmount: quote.totalAmount,
          notes: quote.notes,
          quoteId: quote.id,
          createdBy: userId,
          lines: {
            create: quote.lines.map((l) => ({
              lineNumber: l.lineNumber,
              productServiceId: l.productServiceId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountPercent: l.discountPercent,
              taxAmount: l.taxAmount,
              totalAmount: l.totalAmount,
            })),
          },
        },
        include: { lines: true, contact: true },
      });

      await tx.quote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.CONVERTED, convertedToId: created.id },
      });

      return created;
    });

    return order;
  }

  // ===================================================================
  // Sales Orders
  // ===================================================================

  async listOrders(companyId: string, filters: OrderFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const where: Prisma.SalesOrderWhereInput = { companyId };
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { contact: { select: { id: true, displayName: true } }, lines: true },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async getOrder(companyId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: { contact: true, lines: { orderBy: { lineNumber: "asc" } } },
    });
    if (!order) throw new NotFoundException("Sales order not found");
    return order;
  }

  async createOrder(companyId: string, userId: string, dto: CreateSalesOrderDto) {
    const lineData = dto.lines.map((l, i) => {
      const lineTotal = l.quantity * l.unitPrice * (1 - (l.discountPercent ?? 0) / 100);
      return {
        lineNumber: i + 1,
        productServiceId: l.productServiceId ?? null,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPercent ?? 0,
        taxAmount: l.taxAmount ?? 0,
        totalAmount: lineTotal,
      };
    });

    const subtotal = lineData.reduce((s, l) => s + l.totalAmount, 0);
    const taxAmount = lineData.reduce((s, l) => s + l.taxAmount, 0);

    return this.prisma.$transaction(async (tx) => {
      const num = await this.docSeq.nextNumber(tx, companyId, "SALES_ORDER" as any, new Date().getFullYear());
      const orderNumber = `SO-${String(num).padStart(5, "0")}`;
      return tx.salesOrder.create({
        data: {
          companyId,
          orderNumber,
          contactId: dto.contactId,
          orderDate: new Date(dto.orderDate),
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
          currency: dto.currency ?? "EUR",
          notes: dto.notes,
          quoteId: dto.quoteId,
          subtotalAmount: subtotal,
          taxAmount,
          totalAmount: subtotal + taxAmount,
          createdBy: userId,
          lines: { create: lineData },
        },
        include: { lines: true, contact: true },
      });
    });
  }

  async confirmOrder(companyId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException("Sales order not found");
    if (order.status !== "DRAFT") throw new BadRequestException("Order already confirmed");

    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: SalesOrderStatus.CONFIRMED },
      include: { lines: true, contact: true },
    });
  }

  async cancelOrder(companyId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException("Sales order not found");
    if (order.status === "INVOICED" || order.status === "CANCELLED") {
      throw new BadRequestException("Cannot cancel this order");
    }

    return this.prisma.salesOrder.update({
      where: { id },
      data: { status: SalesOrderStatus.CANCELLED },
      include: { lines: true, contact: true },
    });
  }
}
