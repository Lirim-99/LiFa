import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpsertRateDto } from "./dto";

@Injectable()
export class ExchangeRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, targetCurrency?: string) {
    const where: Prisma.ExchangeRateWhereInput = { companyId };
    if (targetCurrency) where.targetCurrency = targetCurrency;
    return this.prisma.exchangeRate.findMany({
      where,
      orderBy: [{ targetCurrency: "asc" }, { effectiveDate: "desc" }],
      take: 100,
    });
  }

  async upsert(companyId: string, dto: UpsertRateDto) {
    const baseCurrency = dto.baseCurrency ?? "EUR";
    const effectiveDate = new Date(dto.effectiveDate);

    return this.prisma.exchangeRate.upsert({
      where: {
        companyId_baseCurrency_targetCurrency_effectiveDate: {
          companyId,
          baseCurrency,
          targetCurrency: dto.targetCurrency,
          effectiveDate,
        },
      },
      create: {
        companyId,
        baseCurrency,
        targetCurrency: dto.targetCurrency,
        rate: dto.rate,
        effectiveDate,
      },
      update: { rate: dto.rate },
    });
  }

  async delete(companyId: string, id: string) {
    const rate = await this.prisma.exchangeRate.findFirst({ where: { id, companyId } });
    if (!rate) throw new NotFoundException("Exchange rate not found");
    return this.prisma.exchangeRate.delete({ where: { id } });
  }

  /**
   * Get the most recent rate for a currency pair on or before a given date.
   */
  async getRate(companyId: string, targetCurrency: string, date: Date): Promise<number> {
    if (targetCurrency === "EUR") return 1;
    const rate = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        targetCurrency,
        effectiveDate: { lte: date },
      },
      orderBy: { effectiveDate: "desc" },
    });
    return rate ? Number(rate.rate) : 1;
  }
}
