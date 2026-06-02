import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, AuditEntityType, AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(companyId: string, dto: CreateAccountDto, userId: string) {
    if (dto.parentAccountId) {
      await this.assertOwnedAccount(companyId, dto.parentAccountId);
    }
    const existing = await this.prisma.account.findFirst({
      where: { companyId, code: dto.code },
    });
    if (existing) throw new ConflictException(`Account code ${dto.code} already exists`);

    const created = await this.prisma.account.create({
      data: {
        companyId,
        createdBy: userId,
        code: dto.code,
        name: dto.name,
        accountType: dto.accountType,
        normalBalance: dto.normalBalance,
        accountSubtype: dto.accountSubtype,
        parentAccountId: dto.parentAccountId,
        isPostable: dto.isPostable ?? true,
        isSystem: false,
      },
    });
    await this.audit.log({
      companyId,
      userId,
      entityType: AuditEntityType.ACCOUNT,
      entityId: created.id,
      action: AuditAction.CREATED,
      after: { code: created.code, name: created.name, accountType: created.accountType },
    });
    return created;
  }

  findAll(companyId: string) {
    return this.prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: "asc" },
    });
  }

  async findById(companyId: string, id: string) {
    return this.assertOwnedAccount(companyId, id);
  }

  async update(companyId: string, id: string, dto: UpdateAccountDto, userId: string) {
    const current = await this.assertOwnedAccount(companyId, id);

    if (dto.parentAccountId) {
      await this.assertOwnedAccount(companyId, dto.parentAccountId);
      if (dto.parentAccountId === id) {
        throw new BadRequestException("An account cannot be its own parent");
      }
    }

    if (dto.isPostable === true && current.isPostable === false) {
      const childCount = await this.prisma.account.count({
        where: { parentAccountId: id },
      });
      if (childCount > 0) {
        throw new BadRequestException(
          "Cannot mark a parent account as postable while it has child accounts.",
        );
      }
    }

    const updated = await this.prisma.account.update({ where: { id }, data: dto });
    await this.audit.log({
      companyId,
      userId,
      entityType: AuditEntityType.ACCOUNT,
      entityId: id,
      action: AuditAction.UPDATED,
      before: pickBefore(current as Record<string, unknown>, dto as Record<string, unknown>),
      after: dto as Record<string, unknown>,
    });
    return updated;
  }

  async deactivate(companyId: string, id: string, userId: string) {
    const account = await this.assertOwnedAccount(companyId, id);
    if (account.isSystem) {
      throw new BadRequestException("System accounts cannot be deactivated");
    }
    const lineCount = await this.prisma.journalEntryLine.count({
      where: { accountId: id, journalEntry: { status: "POSTED" } },
    });
    if (lineCount > 0) {
      throw new BadRequestException(
        "Cannot deactivate an account with posted journal entry lines.",
      );
    }
    const result = await this.prisma.account.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      companyId,
      userId,
      entityType: AuditEntityType.ACCOUNT,
      entityId: id,
      action: AuditAction.DEACTIVATED,
      before: { code: account.code, name: account.name },
    });
    return result;
  }

  private async assertOwnedAccount(companyId: string, id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException("Account not found");
    return account;
  }
}

function pickBefore(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) out[k] = before[k];
  return out;
}
