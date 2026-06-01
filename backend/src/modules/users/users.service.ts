import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface UserCompanyAccessSummary {
  companyId: string;
  legalName: string;
  tradeName: string | null;
  roleCode: string;
  isDefault: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getCompanies(userId: string): Promise<UserCompanyAccessSummary[]> {
    const accessRows = await this.prisma.userCompanyAccess.findMany({
      where: { userId },
      include: {
        company: { select: { id: true, legalName: true, tradeName: true } },
        role: { select: { code: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return accessRows.map((a) => ({
      companyId: a.company.id,
      legalName: a.company.legalName,
      tradeName: a.company.tradeName,
      roleCode: a.role.code,
      isDefault: a.isDefault,
    }));
  }

  /**
   * Flip `is_default` to point at `companyId`. The user must have access to it.
   * Done in a transaction so we never end up with zero or two defaults.
   */
  async switchDefaultCompany(userId: string, companyId: string): Promise<void> {
    const target = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!target) throw new ForbiddenException("No access to the requested company");

    await this.prisma.$transaction([
      this.prisma.userCompanyAccess.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.userCompanyAccess.update({
        where: { userId_companyId: { userId, companyId } },
        data: { isDefault: true },
      }),
    ]);
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }
}
