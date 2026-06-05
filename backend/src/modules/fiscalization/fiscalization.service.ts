import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FiscalCouponStatus, FiscalCouponType, FiscalProvider, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditAction, AuditEntityType, AuditService } from "../audit/audit.service";
import type { RecordManualCouponDto, UpsertFiscalConfigDto } from "./dto";
import {
  FISCALIZATION_PROVIDERS,
  type FiscalizationProvider,
  type FiscalizeRequest,
} from "./providers/fiscalization-provider.interface";

const DEFAULT_CONFIG = {
  enabled: false,
  provider: FiscalProvider.NONE,
  environment: "TEST",
  businessUnitCode: null,
  operatorCode: null,
  efsSoftwareCode: null,
  efsMaintainer: null,
  verificationBaseUrl: null,
};

@Injectable()
export class FiscalizationService {
  private readonly logger = new Logger(FiscalizationService.name);
  private readonly providers: Map<FiscalProvider, FiscalizationProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(FISCALIZATION_PROVIDERS) providers: FiscalizationProvider[],
  ) {
    this.providers = new Map(providers.map((p) => [p.code, p]));
  }

  // ----------------------------------------------------------------- config

  async getConfig(companyId: string) {
    const config = await this.prisma.companyFiscalConfig.findUnique({ where: { companyId } });
    return config ?? { companyId, ...DEFAULT_CONFIG };
  }

  async upsertConfig(companyId: string, dto: UpsertFiscalConfigDto) {
    return this.prisma.companyFiscalConfig.upsert({
      where: { companyId },
      create: { companyId, ...dto },
      update: { ...dto },
    });
  }

  // ------------------------------------------------- invoice lifecycle hooks

  /**
   * Called after an invoice is issued (post-commit, best-effort). Creates a
   * PENDING fiscal coupon when fiscalization is enabled so the sale shows up as
   * needing fiscalization. Never throws into the caller.
   */
  async onInvoiceIssued(companyId: string, invoiceId: string): Promise<void> {
    try {
      const config = await this.prisma.companyFiscalConfig.findUnique({ where: { companyId } });
      if (!config?.enabled) return;

      const invoice = await this.prisma.invoice.findFirst({
        where: { id: invoiceId, companyId },
      });
      if (!invoice) return;

      await this.prisma.fiscalCoupon.upsert({
        where: { invoiceId },
        create: {
          companyId,
          invoiceId,
          status: FiscalCouponStatus.PENDING,
          couponType: FiscalCouponType.SALE,
          provider: config.provider,
          totalAmount: invoice.totalAmount,
          taxAmount: invoice.taxAmount,
          currency: invoice.currency,
          businessUnitCode: config.businessUnitCode,
          operatorCode: config.operatorCode,
        },
        update: {},
      });
    } catch (err) {
      this.logger.error(
        `onInvoiceIssued failed for invoice ${invoiceId}: ${(err as Error).message}`,
      );
    }
  }

  /** Called after an invoice is voided (post-commit, best-effort). */
  async onInvoiceVoided(companyId: string, invoiceId: string): Promise<void> {
    try {
      await this.prisma.fiscalCoupon.updateMany({
        where: { invoiceId, companyId },
        data: { status: FiscalCouponStatus.VOIDED },
      });
    } catch (err) {
      this.logger.error(
        `onInvoiceVoided failed for invoice ${invoiceId}: ${(err as Error).message}`,
      );
    }
  }

  // --------------------------------------------------------------- coupons

  async getCouponForInvoice(companyId: string, invoiceId: string) {
    return this.prisma.fiscalCoupon.findFirst({ where: { invoiceId, companyId } });
  }

  /** Run the configured provider against an issued invoice and store the result. */
  async fiscalizeInvoice(companyId: string, invoiceId: string, userId: string) {
    const config = await this.prisma.companyFiscalConfig.findUnique({ where: { companyId } });
    if (!config?.enabled || config.provider === FiscalProvider.NONE) {
      throw new BadRequestException("Fiscalization is not enabled for this company.");
    }

    const req = await this.buildRequest(companyId, invoiceId, config);
    const coupon = await this.ensureCoupon(companyId, invoiceId, config.provider, req);

    const provider = this.providers.get(config.provider) ?? this.providers.get(FiscalProvider.NONE);
    let result;
    try {
      result = await provider!.fiscalize(req);
    } catch (err) {
      result = { status: "FAILED" as const, errorMessage: (err as Error).message };
    }

    const status =
      result.status === "FISCALIZED"
        ? FiscalCouponStatus.FISCALIZED
        : result.status === "PENDING"
          ? FiscalCouponStatus.PENDING
          : FiscalCouponStatus.FAILED;

    const updated = await this.prisma.fiscalCoupon.update({
      where: { id: coupon.id },
      data: {
        status,
        fcuin: result.fcuin ?? coupon.fcuin,
        verificationUrl: result.verificationUrl ?? coupon.verificationUrl,
        qrPayload: result.qrPayload ?? coupon.qrPayload,
        taxBlockCode: result.taxBlockCode ?? coupon.taxBlockCode,
        errorMessage: result.errorMessage ?? null,
        fiscalizedAt: status === FiscalCouponStatus.FISCALIZED ? new Date() : coupon.fiscalizedAt,
        requestPayload: (result.requestPayload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        responsePayload: (result.responsePayload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      companyId,
      userId,
      entityType: AuditEntityType.FISCAL_COUPON,
      entityId: updated.id,
      action: AuditAction.FISCALIZED,
      after: { status, provider: config.provider, fcuin: updated.fcuin },
    });

    return updated;
  }

  /** Record an FCUIN/QR obtained manually from ATK's EDI portal (MANUAL_EDI). */
  async recordManualCoupon(
    companyId: string,
    invoiceId: string,
    dto: RecordManualCouponDto,
    userId: string,
  ) {
    const config = await this.prisma.companyFiscalConfig.findUnique({ where: { companyId } });
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const coupon = await this.prisma.fiscalCoupon.upsert({
      where: { invoiceId },
      create: {
        companyId,
        invoiceId,
        status: FiscalCouponStatus.FISCALIZED,
        couponType: FiscalCouponType.SALE,
        provider: config?.provider ?? FiscalProvider.MANUAL_EDI,
        totalAmount: invoice.totalAmount,
        taxAmount: invoice.taxAmount,
        currency: invoice.currency,
        businessUnitCode: config?.businessUnitCode ?? null,
        operatorCode: config?.operatorCode ?? null,
        fcuin: dto.fcuin,
        verificationUrl: dto.verificationUrl ?? null,
        qrPayload: dto.qrPayload ?? null,
        taxBlockCode: dto.taxBlockCode ?? null,
        fiscalizedAt: new Date(),
      },
      update: {
        status: FiscalCouponStatus.FISCALIZED,
        fcuin: dto.fcuin,
        verificationUrl: dto.verificationUrl ?? null,
        qrPayload: dto.qrPayload ?? null,
        taxBlockCode: dto.taxBlockCode ?? null,
        errorMessage: null,
        fiscalizedAt: new Date(),
      },
    });

    await this.audit.log({
      companyId,
      userId,
      entityType: AuditEntityType.FISCAL_COUPON,
      entityId: coupon.id,
      action: AuditAction.FISCALIZED,
      after: { status: coupon.status, fcuin: coupon.fcuin, manual: true },
    });

    return coupon;
  }

  // --------------------------------------------------------------- helpers

  private async ensureCoupon(
    companyId: string,
    invoiceId: string,
    provider: FiscalProvider,
    req: FiscalizeRequest,
  ) {
    return this.prisma.fiscalCoupon.upsert({
      where: { invoiceId },
      create: {
        companyId,
        invoiceId,
        status: FiscalCouponStatus.PENDING,
        couponType: FiscalCouponType.SALE,
        provider,
        totalAmount: req.totalAmount,
        taxAmount: req.taxAmount,
        currency: req.currency,
        businessUnitCode: req.config.businessUnitCode,
        operatorCode: req.config.operatorCode,
      },
      update: { provider },
    });
  }

  private async buildRequest(
    companyId: string,
    invoiceId: string,
    config: {
      provider: FiscalProvider;
      environment: string;
      businessUnitCode: string | null;
      operatorCode: string | null;
      efsSoftwareCode: string | null;
      verificationBaseUrl: string | null;
    },
  ): Promise<FiscalizeRequest> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        company: true,
        contact: true,
        lines: { include: { taxRate: true }, orderBy: { lineNumber: "asc" } },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status === "DRAFT") {
      throw new BadRequestException("Invoice must be issued before it can be fiscalized.");
    }

    return {
      companyId,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      currency: invoice.currency,
      totalAmount: invoice.totalAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      seller: {
        legalName: invoice.company.legalName,
        vatNumber: invoice.company.vatNumber,
        fiscalNumber: invoice.company.fiscalNumber,
      },
      buyer: { name: invoice.contact.displayName, vatNumber: invoice.contact.taxId },
      lines: invoice.lines.map((l) => ({
        description: l.description ?? "",
        quantity: l.quantity.toString(),
        unitPrice: l.unitPrice.toString(),
        netAmount: l.netAmount.toString(),
        taxAmount: l.taxAmount.toString(),
        totalAmount: l.totalAmount.toString(),
        taxRatePercent: l.taxRate ? l.taxRate.rate.toString() : null,
      })),
      config: {
        provider: config.provider,
        environment: config.environment,
        businessUnitCode: config.businessUnitCode,
        operatorCode: config.operatorCode,
        efsSoftwareCode: config.efsSoftwareCode,
        verificationBaseUrl: config.verificationBaseUrl,
      },
    };
  }
}
