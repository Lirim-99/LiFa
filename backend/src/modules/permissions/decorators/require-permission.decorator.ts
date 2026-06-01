import { SetMetadata } from "@nestjs/common";
import type { Permission } from "../permissions.matrix";

export const REQUIRE_PERMISSION_KEY = "requirePermission";

/**
 * Metadata read by `PermissionsGuard`.
 *
 *   @RequirePermission('contacts.create')
 *     uses request.company.companyId (set by CompanyGuard from X-Company-Id).
 *
 *   @RequirePermission('company.update', { companyIdParam: 'id' })
 *     reads companyId from request.params.id — used by routes like
 *     /companies/:id where the company is identified by the URL.
 */
export interface RequirePermissionOptions {
  /** URL param to read companyId from. Defaults to request.company.companyId. */
  companyIdParam?: string;
}

export interface RequirePermissionMetadata {
  permission: Permission;
  options: RequirePermissionOptions;
}

export const RequirePermission = (
  permission: Permission,
  options: RequirePermissionOptions = {},
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { permission, options } satisfies RequirePermissionMetadata);
