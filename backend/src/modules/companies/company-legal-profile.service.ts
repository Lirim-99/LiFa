import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CompaniesService } from "./companies.service";
import { CreateCompanyAddressDto } from "./dto/create-company-address.dto";
import { UpdateCompanyAddressDto } from "./dto/update-company-address.dto";
import { CreateCompanyActivityCodeDto } from "./dto/create-company-activity-code.dto";
import { UpdateCompanyActivityCodeDto } from "./dto/update-company-activity-code.dto";

@Injectable()
export class CompanyLegalProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  // ----- Addresses -------------------------------------------------------

  async listAddresses(companyId: string, userId: string) {
    await this.companies.assertAccess(companyId, userId);
    return this.prisma.companyAddress.findMany({
      where: { companyId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
  }

  async createAddress(companyId: string, dto: CreateCompanyAddressDto, userId: string) {
    await this.companies.assertAccess(companyId, userId);
    return this.prisma.companyAddress.create({
      data: { ...dto, companyId, isPrimary: dto.isPrimary ?? false },
    });
  }

  async updateAddress(
    companyId: string,
    addressId: string,
    dto: UpdateCompanyAddressDto,
    userId: string,
  ) {
    await this.companies.assertAccess(companyId, userId);
    await this.assertOwnedAddress(companyId, addressId);
    return this.prisma.companyAddress.update({ where: { id: addressId }, data: dto });
  }

  async deleteAddress(companyId: string, addressId: string, userId: string) {
    await this.companies.assertAccess(companyId, userId);
    await this.assertOwnedAddress(companyId, addressId);
    await this.prisma.companyAddress.delete({ where: { id: addressId } });
  }

  private async assertOwnedAddress(companyId: string, addressId: string): Promise<void> {
    const record = await this.prisma.companyAddress.findUnique({ where: { id: addressId } });
    if (!record || record.companyId !== companyId) throw new NotFoundException("Address not found");
  }

  // ----- Activity codes --------------------------------------------------

  async listActivityCodes(companyId: string, userId: string) {
    await this.companies.assertAccess(companyId, userId);
    return this.prisma.companyActivityCode.findMany({
      where: { companyId },
      orderBy: [{ activityType: "asc" }, { sortOrder: "asc" }],
    });
  }

  async createActivityCode(companyId: string, dto: CreateCompanyActivityCodeDto, userId: string) {
    await this.companies.assertAccess(companyId, userId);
    return this.prisma.companyActivityCode.create({
      data: { ...dto, companyId, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async updateActivityCode(
    companyId: string,
    codeId: string,
    dto: UpdateCompanyActivityCodeDto,
    userId: string,
  ) {
    await this.companies.assertAccess(companyId, userId);
    await this.assertOwnedActivityCode(companyId, codeId);
    return this.prisma.companyActivityCode.update({ where: { id: codeId }, data: dto });
  }

  async deleteActivityCode(companyId: string, codeId: string, userId: string) {
    await this.companies.assertAccess(companyId, userId);
    await this.assertOwnedActivityCode(companyId, codeId);
    await this.prisma.companyActivityCode.delete({ where: { id: codeId } });
  }

  private async assertOwnedActivityCode(companyId: string, codeId: string): Promise<void> {
    const record = await this.prisma.companyActivityCode.findUnique({ where: { id: codeId } });
    if (!record || record.companyId !== companyId) {
      throw new NotFoundException("Activity code not found");
    }
  }
}
