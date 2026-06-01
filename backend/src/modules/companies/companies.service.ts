import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { DocumentType, Prisma } from "@prisma/client";
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
  ) {}

  /**
   * Creates a company in a single transaction:
   *   1. Insert Company.
   *   2. Insert UserCompanyAccess(owner). is_default=true if user has no other company.
   *   3. Insert DocumentSequence rows for INVOICE + JOURNAL_ENTRY for the current fiscal year.
   *   4. CompanySetupService.seedDefaults — tax rates, chart of accounts, accounting
   *      periods, company account defaults.
   *
   * If any step fails the whole company creation rolls back — no half-seeded companies.
   */
  async create(dto: CreateCompanyDto, userId: string) {
    const ownerRole = await this.prisma.role.findUnique({ where: { code: OWNER_ROLE_CODE } });
    if (!ownerRole) {
      // Seed data missing — fail loudly so we don't silently grant a user an undefined role.
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

      return company;
    });
  }

  /** Returns the companies the user can access, with role + default flag. */
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

  /** Loads a company the user has access to. Returns 404 on no access or missing record. */
  async findById(companyId: string, userId: string) {
    await this.assertAccess(companyId, userId);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Company not found");
    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto, userId: string) {
    await this.assertAccess(companyId, userId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: dto as Prisma.CompanyUpdateInput,
    });
  }

  /**
   * Throws NotFoundException if the user has no UserCompanyAccess for `companyId`.
   * Using 404 (not 403) deliberately — we don't leak existence across companies.
   */
  async assertAccess(companyId: string, userId: string): Promise<void> {
    const access = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!access) throw new NotFoundException("Company not found");
  }

  /**
   * Stricter variant: requires a specific role. Step 6 introduces a full
   * permission matrix; for Step 5 this just guards owner/admin-only actions.
   */
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

  /**
   * Maps a calendar date to the company's fiscal year, given its start month.
   *   start month = 1 (January)   → fiscal year = calendar year
   *   start month = 7, date = Mar → fiscal year = previous calendar year
   *   start month = 7, date = Aug → fiscal year = current calendar year
   */
  private currentFiscalYear(startMonth: number, today: Date = new Date()): number {
    const month = today.getMonth() + 1; // 1-12
    const year = today.getFullYear();
    return month >= startMonth ? year : year - 1;
  }
}
