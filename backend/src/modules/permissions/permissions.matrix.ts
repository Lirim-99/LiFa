/**
 * MVP role/permission matrix. Hardcoded — per IMPLEMENTATION_PLAN §6.
 * Custom or per-user permissions are post-MVP.
 *
 * A permission is a dotted string ("contacts.create", "invoices.read").
 * A role may hold either an exact permission or a wildcard ("contacts.*").
 * `hasPermission()` resolves both forms.
 */

export type RoleCode = "owner" | "admin" | "accountant" | "viewer";

export const ROLE_CODES: readonly RoleCode[] = ["owner", "admin", "accountant", "viewer"];

// Concrete permissions exercised in MVP. Add a string here when a new
// @RequirePermission(...) usage appears — keeps the registry in one place.
export type Permission =
  | "company.update"
  | "contacts.create"
  | "contacts.read"
  | "contacts.update"
  | "contacts.delete"
  | "catalog.create"
  | "catalog.read"
  | "catalog.update"
  | "catalog.delete"
  | "tax.create"
  | "tax.read"
  | "tax.update"
  | "tax.delete"
  | "accounting.create"
  | "accounting.read"
  | "accounting.update"
  | "accounting.delete"
  | "invoices.create"
  | "invoices.read"
  | "invoices.update"
  | "invoices.delete"
  | "invoices.issue"
  | "invoices.void"
  | "payments.create"
  | "payments.read"
  | "payments.void"
  | "reports.read"
  | "audit.read"
  | "permissions.manage";

// Wildcards are stored alongside exact permissions in each role's set.
const PERMISSIONS_BY_ROLE: Record<RoleCode, ReadonlySet<string>> = {
  owner: new Set<string>([
    "company.update",
    "contacts.*",
    "catalog.*",
    "tax.*",
    "accounting.*",
    "invoices.*",
    "payments.*",
    "reports.read",
    "audit.read",
    "permissions.manage",
  ]),
  admin: new Set<string>([
    "company.update",
    "contacts.*",
    "catalog.*",
    "tax.*",
    "accounting.*",
    "invoices.*",
    "payments.*",
    "reports.read",
    "audit.read",
    "permissions.manage",
  ]),
  accountant: new Set<string>([
    "contacts.*",
    "catalog.*",
    "tax.*",
    "accounting.*",
    "invoices.*",
    "payments.*",
    "reports.read",
    "audit.read",
  ]),
  viewer: new Set<string>(["reports.read"]),
};

export function isValidRoleCode(code: string): code is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(code);
}

/**
 * True if `roleCode` is allowed to perform `permission`. Matches either:
 *   - an exact string, e.g. "invoices.issue"
 *   - a wildcard prefix, e.g. "invoices.*" covers all "invoices.X"
 */
export function roleHasPermission(roleCode: string, permission: string): boolean {
  if (!isValidRoleCode(roleCode)) return false;
  const allowed = PERMISSIONS_BY_ROLE[roleCode];
  if (allowed.has(permission)) return true;

  // Wildcard check: "invoices.issue" → look for "invoices.*"
  const dot = permission.indexOf(".");
  if (dot < 0) return false;
  const wildcard = `${permission.slice(0, dot)}.*`;
  return allowed.has(wildcard);
}
