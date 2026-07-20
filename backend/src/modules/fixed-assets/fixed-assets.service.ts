import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateAssetDto, RunDepreciationDto, UpdateAssetDto } from "./dto";

@Injectable()
export class FixedAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, status?: string) {
    const where: Prisma.FixedAssetWhereInput = { companyId };
    if (status) where.status = status as any;
    return this.prisma.fixedAsset.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { depreciationEntries: true } } },
    });
  }

  async get(companyId: string, id: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, companyId },
      include: { depreciationEntries: { orderBy: { periodDate: "desc" } } },
    });
    if (!asset) throw new NotFoundException("Fixed asset not found");
    return asset;
  }

  async create(companyId: string, userId: string, dto: CreateAssetDto) {
    const netBookValue = dto.purchaseCost - (dto.residualValue ?? 0);
    return this.prisma.fixedAsset.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code,
        category: dto.category,
        purchaseDate: new Date(dto.purchaseDate),
        purchaseCost: dto.purchaseCost,
        residualValue: dto.residualValue ?? 0,
        usefulLifeMonths: dto.usefulLifeMonths,
        depreciationMethod: dto.depreciationMethod ?? "STRAIGHT_LINE",
        netBookValue,
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.fixedAsset.findFirst({ where: { id, companyId } });
    if (!asset) throw new NotFoundException("Fixed asset not found");
    if (asset.status !== "ACTIVE") throw new BadRequestException("Cannot edit a non-active asset");

    return this.prisma.fixedAsset.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        category: dto.category,
        purchaseDate: new Date(dto.purchaseDate),
        purchaseCost: dto.purchaseCost,
        residualValue: dto.residualValue ?? 0,
        usefulLifeMonths: dto.usefulLifeMonths,
        depreciationMethod: dto.depreciationMethod,
        notes: dto.notes,
      },
    });
  }

  /**
   * Run monthly depreciation for all active assets in the company.
   * Creates a DepreciationEntry per asset and updates accumulated/NBV.
   */
  async runDepreciation(companyId: string, dto: RunDepreciationDto) {
    const periodDate = new Date(dto.periodDate);
    const assets = await this.prisma.fixedAsset.findMany({
      where: { companyId, status: "ACTIVE" },
    });

    const results: { assetId: string; amount: number }[] = [];

    for (const asset of assets) {
      const depreciable = Number(asset.purchaseCost) - Number(asset.residualValue);
      let monthlyAmount: number;

      if (asset.depreciationMethod === "STRAIGHT_LINE") {
        monthlyAmount = depreciable / asset.usefulLifeMonths;
      } else {
        // Declining balance: 2x straight-line rate applied to NBV
        const rate = (2 / asset.usefulLifeMonths);
        monthlyAmount = Number(asset.netBookValue) * rate;
      }

      // Don't depreciate below residual value
      const currentNBV = Number(asset.netBookValue);
      const maxDepr = currentNBV - Number(asset.residualValue);
      monthlyAmount = Math.min(Math.round(monthlyAmount * 100) / 100, Math.max(maxDepr, 0));

      if (monthlyAmount <= 0) continue;

      const newAccumulated = Number(asset.accumulatedDepr) + monthlyAmount;
      const newNBV = Number(asset.purchaseCost) - newAccumulated;
      const isFullyDepreciated = newNBV <= Number(asset.residualValue);

      await this.prisma.$transaction([
        this.prisma.depreciationEntry.create({
          data: { assetId: asset.id, periodDate, amount: monthlyAmount },
        }),
        this.prisma.fixedAsset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepr: newAccumulated,
            netBookValue: newNBV,
            status: isFullyDepreciated ? "FULLY_DEPRECIATED" : "ACTIVE",
          },
        }),
      ]);

      results.push({ assetId: asset.id, amount: monthlyAmount });
    }

    return { periodDate: dto.periodDate, assetsProcessed: results.length, entries: results };
  }

  async dispose(companyId: string, id: string, disposalDate: string, disposalAmount: number) {
    const asset = await this.prisma.fixedAsset.findFirst({ where: { id, companyId } });
    if (!asset) throw new NotFoundException("Fixed asset not found");
    if (asset.status === "DISPOSED") throw new BadRequestException("Asset already disposed");

    return this.prisma.fixedAsset.update({
      where: { id },
      data: {
        status: "DISPOSED",
        disposalDate: new Date(disposalDate),
        disposalAmount,
      },
    });
  }
}
