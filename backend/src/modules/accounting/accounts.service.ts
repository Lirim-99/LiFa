import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateAccountDto, userId: string) {
    if (dto.parentAccountId) {
      await this.assertOwnedAccount(companyId, dto.parentAccountId);
    }
    const existing = await this.prisma.account.findFirst({
      where: { companyId, code: dto.code },
    });
    if (existing) throw new ConflictException(`Account code ${dto.code} already exists`);

    return this.prisma.account.create({
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

  async update(companyId: string, id: string, dto: UpdateAccountDto) {
    const current = await this.assertOwnedAccount(companyId, id);

    if (dto.parentAccountId) {
      await this.assertOwnedAccount(companyId, dto.parentAccountId);
      if (dto.parentAccountId === id) {
        throw new BadRequestException("An account cannot be its own parent");
      }
    }

    // Cannot flip a parent account to is_postable=true while it has children:
    // posting onto a roll-up account corrupts the hierarchy semantics.
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

    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async deactivate(companyId: string, id: string) {
    const account = await this.assertOwnedAccount(companyId, id);
    if (account.isSystem) {
      throw new BadRequestException("System accounts cannot be deactivated");
    }
    // Accounts with posted journal lines cannot be deactivated — they're
    // permanent ledger references.
    const lineCount = await this.prisma.journalEntryLine.count({
      where: { accountId: id, journalEntry: { status: "POSTED" } },
    });
    if (lineCount > 0) {
      throw new BadRequestException(
        "Cannot deactivate an account with posted journal entry lines.",
      );
    }
    return this.prisma.account.update({ where: { id }, data: { isActive: false } });
  }

  private async assertOwnedAccount(companyId: string, id: string) {
    const account = await this.prisma.account.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException("Account not found");
    return account;
  }
}
