import { AccountType, NormalBalance } from "@prisma/client";

/**
 * Default chart of accounts seeded on company creation.
 *
 * **Needs accountant validation** — placeholder per PRODUCT_BRIEF §2.7.
 * IFRS-for-SMEs-aligned and fully editable by the user.
 *
 * `isSystem` accounts cannot be deleted; their codes are wired into
 * CompanyAccountDefaults so the posting engine knows where to debit/credit
 * during invoice/payment journal generation.
 */
export interface DefaultAccount {
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  accountSubtype?: string;
  isSystem?: boolean;
}

export const DEFAULT_CHART_OF_ACCOUNTS: readonly DefaultAccount[] = [
  // Assets
  {
    code: "1100",
    name: "Cash",
    accountType: AccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isSystem: true,
  },
  {
    code: "1200",
    name: "Bank",
    accountType: AccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isSystem: true,
  },
  {
    code: "1300",
    name: "Accounts Receivable",
    accountType: AccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
    isSystem: true,
  },
  {
    code: "1500",
    name: "Fixed Assets",
    accountType: AccountType.ASSET,
    normalBalance: NormalBalance.DEBIT,
  },

  // Liabilities
  {
    code: "2100",
    name: "Accounts Payable",
    accountType: AccountType.LIABILITY,
    normalBalance: NormalBalance.CREDIT,
    isSystem: true,
  },
  {
    code: "2200",
    name: "VAT Payable",
    accountType: AccountType.LIABILITY,
    normalBalance: NormalBalance.CREDIT,
    isSystem: true,
  },
  {
    code: "2300",
    name: "Loans",
    accountType: AccountType.LIABILITY,
    normalBalance: NormalBalance.CREDIT,
  },

  // Equity
  {
    code: "3100",
    name: "Share Capital",
    accountType: AccountType.EQUITY,
    normalBalance: NormalBalance.CREDIT,
  },
  {
    code: "3200",
    name: "Retained Earnings",
    accountType: AccountType.EQUITY,
    normalBalance: NormalBalance.CREDIT,
    isSystem: true,
  },

  // Revenue
  {
    code: "4100",
    name: "Sales Revenue",
    accountType: AccountType.REVENUE,
    normalBalance: NormalBalance.CREDIT,
    isSystem: true,
  },
  {
    code: "4200",
    name: "Service Revenue",
    accountType: AccountType.REVENUE,
    normalBalance: NormalBalance.CREDIT,
  },

  // Expenses
  {
    code: "5100",
    name: "Cost of Goods Sold",
    accountType: AccountType.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
  },
  {
    code: "5200",
    name: "Salaries",
    accountType: AccountType.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
  },
  {
    code: "5300",
    name: "Rent",
    accountType: AccountType.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
  },
  {
    code: "5400",
    name: "Utilities",
    accountType: AccountType.EXPENSE,
    normalBalance: NormalBalance.DEBIT,
  },
] as const;

/**
 * Map an AccountRole to its default CoA code. Used by CompanySetupService to
 * populate the CompanyAccountDefaults table after seeding the CoA.
 */
export const DEFAULT_ACCOUNT_ROLE_CODES = {
  ACCOUNTS_RECEIVABLE: "1300",
  CASH: "1100",
  BANK: "1200",
  VAT_PAYABLE: "2200",
  SALES_REVENUE: "4100",
} as const;
