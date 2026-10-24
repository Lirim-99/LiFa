import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountRole, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerPostingService } from "../accounting/ledger-posting.service";
import type { CreateAssetDto, RunDepreciationDto, UpdateAssetDto } from "./dto";

@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerPostingService,
  ) {}

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
   * Run monthly depreciation for all active assets and post
   * Dr Depreciation expense / Cr Accumulated depreciation.
   */
  async runDepreciation(companyId: string, userId: string, dto: RunDepreciationDto) {
    const periodDate = new Date(dto.periodDate);
    return this.prisma.$transaction(async (tx) => {
      const assets = await tx.fixedAsset.findMany({
        where: { companyId, status: "ACTIVE" },
      });

      const planned: { assetId: string; name: string; amount: Prisma.Decimal; accumulated: Prisma.Decimal; nbv: Prisma.Decimal; fully: boolean }[] = [];

      for (const asset of assets) {
        const already = await tx.depreciationEntry.findFirst({
          where: { assetId: asset.id, periodDate },
        });
        if (already) continue;

        const cost = new Prisma.Decimal(asset.purchaseCost);
        const residual = new Prisma.Decimal(asset.residualValue);
        const life = new Prisma.Decimal(asset.usefulLifeMonths);
        let monthly: Prisma.Decimal;
        if (asset.depreciationMethod === "STRAIGHT_LINE") {
          monthly = cost.minus(residual).div(life);
        } else {
          monthly = new Prisma.Decimal(asset.netBookValue).times(new Prisma.Decimal(2).div(life));
        }
        const maxDepr = Prisma.Decimal.max(
          new Prisma.Decimal(asset.netBookValue).minus(residual),
          new Prisma.Decimal(0),
        );
        monthly = Prisma.Decimal.min(monthly.toDecimalPlaces(2), maxDepr);
        if (monthly.lte(0)) continue;

        const accumulated = new Prisma.Decimal(asset.accumulatedDepr).plus(monthly);
        const nbv = cost.minus(accumulated);
        planned.push({
          assetId: asset.id,
          name: asset.name,
          amount: monthly,
          accumulated,
          nbv,
          fully: nbv.lte(residual),
        });
      }

      if (planned.length === 0) {
        return { periodDate: dto.periodDate, assetsProcessed: 0, entries: [], entryNumber: null };
      }

      const expenseId = await this.accountFor(tx, companyId, AccountRole.DEPRECIATION_EXPENSE);
      const accumId = await this.accountFor(tx, companyId, AccountRole.ACCUMULATED_DEPRECIATION);
      const entry = await this.ledger.post(tx, {
        companyId,
        userId,
        entryDate: periodDate,
        sourceDocumentType: "DEPRECIATION",
        sourceDocumentId: planned[0].assetId,
        memo: `Depreciation ${dto.periodDate}`,
        lines: planned.flatMap((row) => [
          { accountId: expenseId, debit: row.amount, description: row.name },
          { accountId: accumId, credit: row.amount, description: row.name },
        ]),
      });

      for (const row of planned) {
        await tx.depreciationEntry.create({
          data: {
            assetId: row.assetId,
            periodDate,
            amount: row.amount,
            journalEntryId: entry?.id,
          },
        });
        await tx.fixedAsset.update({
          where: { id: row.assetId },
          data: {
            accumulatedDepr: row.accumulated,
            netBookValue: row.nbv,
            status: row.fully ? "FULLY_DEPRECIATED" : "ACTIVE",
          },
        });
      }

      return {
        periodDate: dto.periodDate,
        assetsProcessed: planned.length,
        entryNumber: entry?.entryNumber ?? null,
        entries: planned.map((row) => ({ assetId: row.assetId, amount: row.amount.toFixed(2) })),
      };
    });
  }

  /**
   * Clears the asset and accumulated depreciation and records cash proceeds
   * plus gain or loss. The purchase itself is assumed to already sit on the
   * fixed-asset account (bill or manual journal).
   */
  async dispose(companyId: string, id: string, userId: string, disposalDate: string, disposalAmount: number) {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.findFirst({ where: { id, companyId } });
      if (!asset) throw new NotFoundException("Fixed asset not found");
      if (asset.status === "DISPOSED") throw new BadRequestException("Asset already disposed");

      const cost = new Prisma.Decimal(asset.purchaseCost);
      const accum = new Prisma.Decimal(asset.accumulatedDepr);
      const proceeds = new Prisma.Decimal(disposalAmount);
      const gain = proceeds.minus(cost.minus(accum));
      const when = new Date(disposalDate);

      const [bankId, assetId, accumId, gainId, lossId] = await Promise.all([
        this.accountFor(tx, companyId, AccountRole.BANK),
        this.accountFor(tx, companyId, AccountRole.FIXED_ASSET),
        this.accountFor(tx, companyId, AccountRole.ACCUMULATED_DEPRECIATION),
        this.accountFor(tx, companyId, AccountRole.DISPOSAL_GAIN),
        this.accountFor(tx, companyId, AccountRole.DISPOSAL_LOSS),
      ]);

      const entry = await this.ledger.post(tx, {
        companyId,
        userId,
        entryDate: when,
        sourceDocumentType: "ASSET_DISPOSAL",
        sourceDocumentId: asset.id,
        memo: `Disposal of ${asset.name}`,
        lines: [
          { accountId: bankId, debit: proceeds, description: "Disposal proceeds" },
          { accountId: accumId, debit: accum, description: "Clear accumulated depreciation" },
          { accountId: lossId, debit: gain.isNeg() ? gain.abs() : 0, description: "Loss on disposal" },
          { accountId: assetId, credit: cost, description: asset.name },
          { accountId: gainId, credit: gain.gt(0) ? gain : 0, description: "Gain on disposal" },
        ],
      });

      return tx.fixedAsset.update({
        where: { id },
        data: {
          status: "DISPOSED",
          disposalDate: when,
          disposalAmount: proceeds,
          disposalJournalEntryId: entry?.id,
        },
      });
    });
  }

  private async accountFor(
    tx: Prisma.TransactionClient,
    companyId: string,
    role: AccountRole,
  ): Promise<string> {
    const row = await tx.companyAccountDefaults.findUnique({
      where: { companyId_accountRole: { companyId, accountRole: role } },
    });
    if (!row) {
      throw new BadRequestException(
        `Company account default not configured for role ${role}. Set it in company settings.`,
      );
    }
    return row.accountId;
  }
}
