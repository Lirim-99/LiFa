/**
 * Mirrors the backend enums + a handful of response shapes. Kept in the
 * frontend to avoid pulling Prisma (server-only) into client bundles.
 */

export const LEGAL_FORMS = [
  { value: "BI", label: "BI — Individual business" },
  { value: "OP", label: "OP — General partnership" },
  { value: "KO", label: "KO — Limited partnership" },
  { value: "SHPK", label: "SHPK — Limited liability company" },
  { value: "SHA", label: "SHA — Joint-stock company" },
  { value: "FOREIGN_BRANCH", label: "Foreign branch" },
  { value: "NGO", label: "NGO" },
  { value: "OTHER", label: "Other" },
] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number]["value"];

export const ADDRESS_TYPES = [
  { value: "REGISTERED", label: "Registered" },
  { value: "BUSINESS", label: "Business" },
  { value: "OTHER", label: "Other" },
] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number]["value"];

export const ACTIVITY_TYPES = [
  { value: "PRIMARY", label: "Primary" },
  { value: "SECONDARY", label: "Secondary" },
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number]["value"];

export const ROLE_CODES = ["owner", "admin", "accountant", "viewer"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const PRODUCT_SERVICE_TYPES = [
  { value: "PRODUCT", label: "Product" },
  { value: "SERVICE", label: "Service" },
] as const;
export type ProductServiceType = (typeof PRODUCT_SERVICE_TYPES)[number]["value"];

export const TAX_CALCULATION_TYPES = [
  { value: "EXCLUSIVE", label: "Exclusive (net + tax)" },
  { value: "INCLUSIVE", label: "Inclusive (gross contains tax)" },
] as const;
export type TaxCalculationType = (typeof TAX_CALCULATION_TYPES)[number]["value"];

export const TAX_SCOPES = [
  { value: "SALES", label: "Sales" },
  { value: "PURCHASES", label: "Purchases" },
  { value: "BOTH", label: "Both" },
] as const;
export type TaxScope = (typeof TAX_SCOPES)[number]["value"];

export const ACCOUNT_TYPES = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

export const NORMAL_BALANCES = [
  { value: "DEBIT", label: "Debit" },
  { value: "CREDIT", label: "Credit" },
] as const;
export type NormalBalance = (typeof NORMAL_BALANCES)[number]["value"];

// --- Response shapes from the backend ---

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserCompanyAccessSummary {
  companyId: string;
  legalName: string;
  tradeName: string | null;
  roleCode: RoleCode;
  isDefault: boolean;
}

export interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
  legalForm: LegalForm;
  uinNui: string | null;
  fiscalNumber: string | null;
  vatNumber: string | null;
  registrationDate: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  defaultCurrency: string;
  fiscalYearStartMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyAddress {
  id: string;
  companyId: string;
  addressType: AddressType;
  country: string | null;
  municipality: string | null;
  city: string | null;
  street: string | null;
  postalCode: string | null;
  isPrimary: boolean;
}

export interface CompanyActivityCode {
  id: string;
  companyId: string;
  activityType: ActivityType;
  code: string;
  description: string | null;
  sortOrder: number;
}

export interface Contact {
  id: string;
  companyId: string;
  isCustomer: boolean;
  isVendor: boolean;
  displayName: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  paymentTermsDays: number | null;
  currency: string;
  country: string | null;
  municipality: string | null;
  city: string | null;
  street: string | null;
  postalCode: string | null;
  isActive: boolean;
  notes: string | null;
}

export interface ProductService {
  id: string;
  companyId: string;
  type: ProductServiceType;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  salePrice: string | null;
  purchasePrice: string | null;
  incomeAccountId: string | null;
  expenseAccountId: string | null;
  defaultTaxRateId: string | null;
  isActive: boolean;
}

export interface TaxRate {
  id: string;
  companyId: string | null;
  name: string;
  code: string;
  rate: string;
  calculationType: TaxCalculationType;
  scope: TaxScope;
  isDefault: boolean;
  isActive: boolean;
}

export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  accountType: AccountType;
  accountSubtype: string | null;
  normalBalance: NormalBalance;
  parentAccountId: string | null;
  isPostable: boolean;
  isSystem: boolean;
  isActive: boolean;
}

// --- FE-4: Periods / JE / Invoices / Payments ---

export const PERIOD_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number]["value"];

export const INVOICE_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["value"];

export const PAYMENT_STATUSES = [
  { value: "RECORDED", label: "Recorded" },
  { value: "VOID", label: "Void" },
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]["value"];

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const JOURNAL_ENTRY_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
] as const;
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number]["value"];

export const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "Percentage %" },
  { value: "FIXED", label: "Fixed amount" },
] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number]["value"];

export interface AccountingPeriod {
  id: string;
  companyId: string;
  fiscalYear: number;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt: string | null;
  closedBy: string | null;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  lineNumber: number;
  accountId: string;
  description: string | null;
  debitAmount: string;
  creditAmount: string;
  currency: string;
  contactId: string | null;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  entryNumber: string | null;
  entryDate: string;
  periodId: string | null;
  sourceDocumentType: string | null;
  sourceDocumentId: string | null;
  memo: string | null;
  status: JournalEntryStatus;
  postedAt: string | null;
  postedBy: string | null;
  reversalOfEntryId: string | null;
  reversedByEntryId: string | null;
  lines?: JournalEntryLine[];
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  lineNumber: number;
  productServiceId: string | null;
  description: string | null;
  quantity: string;
  unitPrice: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  taxRateId: string | null;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  incomeAccountId: string | null;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string | null;
  contactId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  status: InvoiceStatus;
  notes: string | null;
  postedJournalEntryId: string | null;
  voidedJournalEntryId: string | null;
  createdAt: string;
  lines?: InvoiceLine[];
  contact?: { id: string; displayName: string; email?: string | null };
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  allocatedAmount: string;
  allocationDate: string;
  isVoided: boolean;
  invoice?: { id: string; invoiceNumber: string | null; totalAmount: string; balanceDue: string };
}

export interface Payment {
  id: string;
  companyId: string;
  contactId: string;
  paymentType: "RECEIVED" | "MADE";
  paymentMethod: PaymentMethod;
  paymentDate: string;
  referenceNumber: string | null;
  currency: string;
  totalAmount: string;
  status: PaymentStatus;
  notes: string | null;
  postedJournalEntryId: string | null;
  voidedJournalEntryId: string | null;
  allocations?: PaymentAllocation[];
  contact?: { id: string; displayName: string; email?: string | null };
}
