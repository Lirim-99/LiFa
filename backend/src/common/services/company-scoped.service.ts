import { NotFoundException } from "@nestjs/common";

/**
 * Optional base for services that own company-scoped resources.
 *
 * The PRIMARY mechanism for company isolation in LiFa is the **explicit**
 * inclusion of `company_id: companyId` in every Prisma `where`/`create` —
 * see `backend/CONVENTIONS.md`. This base class only provides a small helper
 * for the rare case where a record has already been loaded (e.g. via an
 * include-traversal) and you want to assert ownership before returning it.
 *
 *   const invoice = await this.prisma.invoice.findUnique({ where: { id } });
 *   this.ensureCompanyMatch(invoice, companyId); // throws 404 on mismatch
 */
export abstract class CompanyScopedService {
  protected ensureCompanyMatch(
    record: { company_id?: string; companyId?: string } | null | undefined,
    companyId: string,
  ): void {
    if (!record) throw new NotFoundException();
    const recordCompanyId = record.companyId ?? record.company_id;
    // Return 404 (not 403) on mismatch so we don't leak existence across companies.
    if (recordCompanyId !== companyId) throw new NotFoundException();
  }
}
