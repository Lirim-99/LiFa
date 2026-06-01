import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaxRateDto } from "./dto/create-tax-rate.dto";
import { UpdateTaxRateDto } from "./dto/update-tax-rate.dto";

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, dto: CreateTaxRateDto) {
    return this.prisma.taxRate.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code,
        rate: dto.rate,
        calculationType: dto.calculationType,
        scope: dto.scope,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  findAll(companyId: string) {
    return this.prisma.taxRate.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: "asc" },
    });
  }

  async findById(companyId: string, id: string) {
    const rate = await this.prisma.taxRate.findFirst({ where: { id, companyId } });
    if (!rate) throw new NotFoundException("Tax rate not found");
    return rate;
  }

  async update(companyId: string, id: string, dto: UpdateTaxRateDto) {
    await this.findById(companyId, id);
    return this.prisma.taxRate.update({ where: { id }, data: dto });
  }

  /** Soft-deactivate (preserve historical references on invoices). */
  async deactivate(companyId: string, id: string) {
    await this.findById(companyId, id);
    return this.prisma.taxRate.update({ where: { id }, data: { isActive: false } });
  }
}
