import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentCompany } from "../../common/decorators/current-company.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { CompanyGuard } from "../auth/guards/company.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PdfService, type PdfCompanyInfo, type PdfContactInfo, type PdfDocumentData, type PdfFiscalData, type PdfLineItem } from "./pdf.service";

@Controller()
@UseGuards(CompanyGuard)
export class PdfController {
  constructor(
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("invoices/:id/pdf")
  @RequirePermission("invoices.read")
  async invoicePdf(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        contact: true,
        company: { include: { addresses: { where: { isPrimary: true }, take: 1 } } },
        fiscalCoupon: true,
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const company = this.mapCompany(invoice.company, invoice.company.addresses[0]);
    const contact = this.mapContact(invoice.contact);
    const lines = this.mapInvoiceLines(invoice.lines);
    const fiscal = this.mapFiscalCoupon(invoice.fiscalCoupon);

    const data: PdfDocumentData = {
      type: "INVOICE",
      documentNumber: invoice.invoiceNumber,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      currency: invoice.currency,
      subtotalAmount: invoice.subtotalAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      paidAmount: invoice.paidAmount.toString(),
      balanceDue: invoice.balanceDue.toString(),
      notes: invoice.notes,
      company,
      contact,
      lines,
      fiscal,
    };

    const buffer = await this.pdf.generateDocument(data);
    const filename = `${invoice.invoiceNumber ?? "DRAFT"}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  @Get("bills/:id/pdf")
  @RequirePermission("invoices.read")
  async billPdf(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        contact: true,
        company: { include: { addresses: { where: { isPrimary: true }, take: 1 } } },
      },
    });
    if (!bill) throw new NotFoundException("Bill not found");

    const company = this.mapCompany(bill.company, bill.company.addresses[0]);
    const contact = this.mapContact(bill.contact);
    const lines = this.mapBillLines(bill.lines);

    const data: PdfDocumentData = {
      type: "BILL",
      documentNumber: bill.billNumber,
      status: bill.status,
      issueDate: bill.billDate.toISOString(),
      dueDate: bill.dueDate.toISOString(),
      currency: bill.currency,
      subtotalAmount: bill.subtotalAmount.toString(),
      taxAmount: bill.taxAmount.toString(),
      totalAmount: bill.totalAmount.toString(),
      paidAmount: bill.paidAmount.toString(),
      balanceDue: bill.balanceDue.toString(),
      notes: bill.notes,
      company,
      contact,
      lines,
    };

    const buffer = await this.pdf.generateDocument(data);
    const filename = `BILL-${bill.billNumber}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  @Get("credit-notes/:id/pdf")
  @RequirePermission("invoices.read")
  async creditNotePdf(
    @CurrentCompany("companyId") companyId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const cn = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        contact: true,
        company: { include: { addresses: { where: { isPrimary: true }, take: 1 } } },
        fiscalCoupon: true,
      },
    });
    if (!cn) throw new NotFoundException("Credit note not found");

    const company = this.mapCompany(cn.company, cn.company.addresses[0]);
    const contact = this.mapContact(cn.contact);
    const lines = this.mapCreditNoteLines(cn.lines);
    const fiscal = this.mapFiscalCoupon(cn.fiscalCoupon);

    const data: PdfDocumentData = {
      type: "CREDIT_NOTE",
      creditNoteType: cn.type,
      documentNumber: cn.creditNoteNumber,
      status: cn.status,
      issueDate: cn.issueDate.toISOString(),
      currency: cn.currency,
      subtotalAmount: cn.subtotalAmount.toString(),
      taxAmount: cn.taxAmount.toString(),
      totalAmount: cn.totalAmount.toString(),
      reason: cn.reason,
      company,
      contact,
      lines,
      fiscal,
    };

    const buffer = await this.pdf.generateDocument(data);
    const filename = `${cn.creditNoteNumber ?? "CN-DRAFT"}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  }

  // =======================================================================
  // Mappers
  // =======================================================================

  private mapCompany(
    c: { legalName: string; tradeName?: string | null; fiscalNumber?: string | null; vatNumber?: string | null; uinNui?: string | null; email?: string | null; phone?: string | null },
    addr?: { street?: string | null; city?: string | null; municipality?: string | null; postalCode?: string | null; country?: string | null } | null,
  ): PdfCompanyInfo {
    return {
      legalName: c.legalName,
      tradeName: c.tradeName,
      fiscalNumber: c.fiscalNumber,
      vatNumber: c.vatNumber,
      uinNui: c.uinNui,
      email: c.email,
      phone: c.phone,
      address: addr ?? null,
    };
  }

  private mapContact(c: {
    displayName: string;
    legalName?: string | null;
    taxId?: string | null;
    email?: string | null;
    phone?: string | null;
    street?: string | null;
    city?: string | null;
    country?: string | null;
  }): PdfContactInfo {
    return {
      displayName: c.displayName,
      legalName: c.legalName,
      taxId: c.taxId,
      email: c.email,
      phone: c.phone,
      street: c.street,
      city: c.city,
      country: c.country,
    };
  }

  private mapInvoiceLines(lines: { lineNumber: number; description: string | null; quantity: unknown; unitPrice: unknown; netAmount: unknown; taxAmount: unknown; totalAmount: unknown }[]): PdfLineItem[] {
    return lines.map((l) => ({
      lineNumber: l.lineNumber,
      description: l.description,
      quantity: String(l.quantity),
      unitPrice: String(l.unitPrice),
      netAmount: String(l.netAmount),
      taxAmount: String(l.taxAmount),
      totalAmount: String(l.totalAmount),
    }));
  }

  private mapBillLines(lines: { lineNumber: number; description: string | null; quantity: unknown; unitPrice: unknown; netAmount: unknown; taxAmount: unknown; totalAmount: unknown }[]): PdfLineItem[] {
    return this.mapInvoiceLines(lines);
  }

  private mapCreditNoteLines(lines: { lineNumber: number; description: string | null; quantity: unknown; unitPrice: unknown; netAmount: unknown; taxAmount: unknown; totalAmount: unknown }[]): PdfLineItem[] {
    return this.mapInvoiceLines(lines);
  }

  private mapFiscalCoupon(
    coupon: { status: string; fcuin: string | null; verificationUrl: string | null; qrPayload: string | null; fiscalizedAt: Date | null; businessUnitCode: string | null; operatorCode: string | null } | null,
  ): PdfFiscalData | null {
    if (!coupon || coupon.status !== "FISCALIZED" || !coupon.fcuin) return null;
    return {
      fcuin: coupon.fcuin,
      verificationUrl: coupon.verificationUrl,
      qrPayload: coupon.qrPayload,
      fiscalizedAt: coupon.fiscalizedAt?.toISOString() ?? null,
      businessUnitCode: coupon.businessUnitCode,
      operatorCode: coupon.operatorCode,
    };
  }
}
