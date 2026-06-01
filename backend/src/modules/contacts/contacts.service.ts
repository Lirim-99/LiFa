import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { paginatedResponse, type PaginatedResponse } from "../../common/dto/paginated-response.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { ContactFilterDto } from "./dto/contact-filter.dto";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateContactDto, userId: string) {
    return this.prisma.contact.create({
      data: {
        companyId,
        createdBy: userId,
        displayName: dto.displayName,
        legalName: dto.legalName,
        isCustomer: dto.isCustomer ?? false,
        isVendor: dto.isVendor ?? false,
        email: dto.email,
        phone: dto.phone,
        taxId: dto.taxId,
        paymentTermsDays: dto.paymentTermsDays,
        currency: dto.currency ?? "EUR",
        country: dto.country,
        municipality: dto.municipality,
        city: dto.city,
        street: dto.street,
        postalCode: dto.postalCode,
        notes: dto.notes,
      },
    });
  }

  async findAll(companyId: string, filters: ContactFilterDto): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = { companyId };
    if (filters.isCustomer !== undefined) where.isCustomer = filters.isCustomer;
    if (filters.isVendor !== undefined) where.isVendor = filters.isVendor;
    // Default to active-only when the caller doesn't specify — matches the
    // "deactivated contact excluded from default list" rule in the spec.
    where.isActive = filters.isActive ?? true;

    if (filters.search) {
      where.OR = [
        { displayName: { contains: filters.search, mode: "insensitive" } },
        { legalName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const sortBy = filters.sortBy ?? "createdAt";
    const sortOrder = filters.sortOrder ?? "desc";
    const orderBy = { [sortBy]: sortOrder } as Prisma.ContactOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.contact.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findById(companyId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, companyId } });
    if (!contact) throw new NotFoundException("Contact not found");
    return contact;
  }

  async update(companyId: string, id: string, dto: UpdateContactDto) {
    const current = await this.findById(companyId, id); // 404 if missing / different company

    // Enforce "at least one of customer/vendor flags must remain true" at the
    // service layer — the DTO can't see existing state, and we want a clear
    // 400 before the DB CHECK fires a generic constraint error.
    const nextIsCustomer = dto.isCustomer ?? current.isCustomer;
    const nextIsVendor = dto.isVendor ?? current.isVendor;
    if (!nextIsCustomer && !nextIsVendor) {
      throw new BadRequestException("A contact must remain a customer, a vendor, or both.");
    }

    return this.prisma.contact.update({
      where: { id },
      data: dto as Prisma.ContactUpdateInput,
    });
  }
}
