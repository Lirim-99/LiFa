import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AddUserAccessDto } from "./dto/add-user-access.dto";
import { UpdateUserAccessDto } from "./dto/update-user-access.dto";
import { roleHasPermission } from "./permissions.matrix";

export interface CompanyUserListItem {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleCode: string;
  isDefault: boolean;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pure check against the in-memory matrix. */
  hasPermission(roleCode: string, permission: string): boolean {
    return roleHasPermission(roleCode, permission);
  }

  async getUserRole(userId: string, companyId: string): Promise<string | null> {
    const access = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { role: { select: { code: true } } },
    });
    return access?.role.code ?? null;
  }

  async listUsers(companyId: string): Promise<CompanyUserListItem[]> {
    const rows = await this.prisma.userCompanyAccess.findMany({
      where: { companyId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        role: { select: { code: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      userId: r.user.id,
      email: r.user.email,
      firstName: r.user.firstName,
      lastName: r.user.lastName,
      roleCode: r.role.code,
      isDefault: r.isDefault,
    }));
  }

  async addUser(companyId: string, dto: AddUserAccessDto) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.role.findUnique({ where: { code: dto.roleCode } }),
    ]);
    if (!user) throw new NotFoundException(`No user found with email ${dto.email}`);
    if (!role) throw new BadRequestException(`Unknown role: ${dto.roleCode}`);

    const existing = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (existing) {
      throw new BadRequestException("User already has access to this company");
    }

    return this.prisma.userCompanyAccess.create({
      data: { userId: user.id, companyId, roleId: role.id, isDefault: false },
    });
  }

  async updateUserRole(companyId: string, targetUserId: string, dto: UpdateUserAccessDto) {
    const role = await this.prisma.role.findUnique({ where: { code: dto.roleCode } });
    if (!role) throw new BadRequestException(`Unknown role: ${dto.roleCode}`);

    const access = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!access) throw new NotFoundException("User does not have access to this company");

    return this.prisma.userCompanyAccess.update({
      where: { userId_companyId: { userId: targetUserId, companyId } },
      data: { roleId: role.id },
    });
  }

  /**
   * Removes a user's access. Safety rules:
   *   - You cannot remove your own access (would lock you out).
   *   - You cannot remove the last owner (would leave the company unmanageable).
   */
  async removeUser(companyId: string, targetUserId: string, actingUserId: string): Promise<void> {
    if (targetUserId === actingUserId) {
      throw new ForbiddenException("Cannot remove your own access");
    }
    const target = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
      include: { role: { select: { code: true } } },
    });
    if (!target) throw new NotFoundException("User does not have access to this company");

    if (target.role.code === "owner") {
      const ownerCount = await this.prisma.userCompanyAccess.count({
        where: { companyId, role: { code: "owner" } },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException("Cannot remove the only owner of this company");
      }
    }

    await this.prisma.userCompanyAccess.delete({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
  }
}
