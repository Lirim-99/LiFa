import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { DocumentType, Prisma } from "@prisma/client";
import { AuditAction, AuditEntityType, AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CompanySetupService } from "./company-setup.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

const OWNER_ROLE_CODE = "owner";

export interface CompanyListItem {
  id: string;
  legalName: string;
  tradeName: string | null;
  roleCode: string;
  isDefault: boolean;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly setup: CompanySetupService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCompanyDto, userId: string) {
    const ownerRole = await this.prisma.role.findUnique({ where: { code: OWNER_ROLE_CODE } });
    if (!ownerRole) {
      throw new InternalServerErrorException(
        `Role '${OWNER_ROLE_CODE}' not found. Run \`pnpm db:seed\`.`,
      );
    }

    const startMonth = dto.fiscalYearStartMonth ?? 1;
    const fiscalYear = this.currentFiscalYear(startMonth);

    return this.prisma.$transaction(async (tx) => {
      const existingAccessCount = await tx.userCompanyAccess.count({ where: { userId } });
      const isDefault = existingAccessCount === 0;

      const company = await tx.company.create({
        data: {
          legalName: dto.legalName,
          legalForm: dto.legalForm,
          tradeName: dto.tradeName,
          uinNui: dto.uinNui,
          fiscalNumber: dto.fiscalNumber,
          vatNumber: dto.vatNumber,
          registrationDate: dto.registrationDate,
          email: dto.email,
          phone: dto.phone,
          website: dto.website,
          defaultCurrency: dto.defaultCurrency ?? "EUR",
          fiscalYearStartMonth: startMonth,
          createdBy: userId,
        },
      });

      await tx.userCompanyAccess.create({
        data: { userId, companyId: company.id, roleId: ownerRole.id, isDefault },
      });

      await tx.documentSequence.createMany({
        data: [
          {
            companyId: company.id,
            documentType: DocumentType.INVOICE,
            fiscalYear,
            prefix: `INV-${fiscalYear}-`,
          },
          {
            companyId: company.id,
            documentType: DocumentType.JOURNAL_ENTRY,
            fiscalYear,
            prefix: `JE-${fiscalYear}-`,
          },
        ],
      });

      await this.setup.seedDefaults(tx, {
        companyId: company.id,
        createdBy: userId,
        fiscalYearStartMonth: startMonth,
        fiscalYear,
      });

      await this.audit.log(
        {
          companyId: company.id,
          userId,
          entityType: AuditEntityType.COMPANY,
          entityId: company.id,
          action: AuditAction.CREATED,
          after: { legalName: company.legalName, legalForm: company.legalForm },
        },
        tx,
      );

      return company;
    });
  }

  async findByUser(userId: string): Promise<CompanyListItem[]> {
    const rows = await this.prisma.userCompanyAccess.findMany({
      where: { userId },
      include: {
        company: { select: { id: true, legalName: true, tradeName: true } },
        role: { select: { code: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.company.id,
      legalName: r.company.legalName,
      tradeName: r.company.tradeName,
      roleCode: r.role.code,
      isDefault: r.isDefault,
    }));
  }

  async findById(companyId: string, userId: string) {
    await this.assertAccess(companyId, userId);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Company not found");
    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto, userId: string) {
    await this.assertAccess(companyId, userId);
    const before = await this.prisma.company.findUnique({ where: { id: companyId } });
    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: dto as Prisma.CompanyUpdateInput,
    });
    await this.audit.log({
      companyId,
      userId,
      entityType: AuditEntityType.COMPANY,
      entityId: companyId,
      action: AuditAction.UPDATED,
      before: diffSummary(before as Record<string, unknown> | null, dto as Record<string, unknown>),
      after: dto as Record<string, unknown>,
    });
    return updated;
  }

  async assertAccess(companyId: string, userId: string): Promise<void> {
    const access = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!access) throw new NotFoundException("Company not found");
  }

  async assertRole(companyId: string, userId: string, allowed: string[]): Promise<void> {
    const access = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { role: true },
    });
    if (!access) throw new NotFoundException("Company not found");
    if (!allowed.includes(access.role.code)) {
      throw new ForbiddenException(`Requires role: ${allowed.join(" | ")}`);
    }
  }

  private currentFiscalYear(startMonth: number, today: Date = new Date()): number {
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    return month >= startMonth ? year : year - 1;
  }
}

/** Picks only the keys touched by a PATCH from the previous record. */
function diffSummary(
  before: Record<string, unknown> | null,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (!before) return {};
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) out[k] = before[k];
  return out;
}
