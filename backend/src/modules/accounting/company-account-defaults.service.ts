import { Injectable, NotFoundException } from "@nestjs/common";
import { AccountRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CompanyAccountDefaultsService {
  constructor(private readonly prisma: PrismaService) {}

  getDefaults(companyId: string) {
    return this.prisma.companyAccountDefaults.findMany({
      where: { companyId },
      include: { account: { select: { id: true, code: true, name: true } } },
    });
  }

  /**
   * Returns the account.id mapped to `role` for `companyId`. Used by the
   * posting engine in Step 11/13 — throws if not configured, because invoice
   * issue and payment recording can't pick a default account.
   */
  async getAccountForRole(companyId: string, role: AccountRole): Promise<string> {
    const row = await this.prisma.companyAccountDefaults.findUnique({
      where: { companyId_accountRole: { companyId, accountRole: role } },
    });
    if (!row) {
      throw new NotFoundException(
        `Company account default not configured for role ${role}. Set it in company settings.`,
      );
    }
    return row.accountId;
  }

  async setDefault(companyId: string, role: AccountRole, accountId: string) {
    // Validate the account exists and belongs to the same company.
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId },
    });
    if (!account) throw new NotFoundException("Account not found");

    return this.prisma.companyAccountDefaults.upsert({
      where: { companyId_accountRole: { companyId, accountRole: role } },
      create: { companyId, accountRole: role, accountId },
      update: { accountId },
    });
  }
}
