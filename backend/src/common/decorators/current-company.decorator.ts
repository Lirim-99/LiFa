import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";

export interface CompanyContext {
  companyId: string;
  roleCode: string;
}

/**
 * Extracts the active company context resolved by `CompanyGuard` from the
 * `X-Company-Id` header (or the user's default company). Service methods that
 * touch company-scoped data must use this `companyId` in every Prisma query.
 */
export const CurrentCompany = createParamDecorator<keyof CompanyContext | undefined>(
  (data, ctx: ExecutionContext): CompanyContext | CompanyContext[keyof CompanyContext] => {
    const request = ctx.switchToHttp().getRequest<Request & { company?: CompanyContext }>();
    const company = request.company;
    if (!company) {
      throw new Error(
        "CurrentCompany used on a request without a resolved company. Apply CompanyGuard.",
      );
    }
    return data ? company[data] : company;
  },
);
