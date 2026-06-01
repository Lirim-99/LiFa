import { AccountRole } from "@prisma/client";
import { CompanySetupService } from "./company-setup.service";
import {
  DEFAULT_ACCOUNT_ROLE_CODES,
  DEFAULT_CHART_OF_ACCOUNTS,
} from "../accounting/data/default-chart-of-accounts";

type AccountRow = { id: string; companyId: string; code: string };
type TaxTemplate = {
  id: string;
  companyId: null;
  name: string;
  code: string;
  rate: number;
  calculationType: string;
  scope: string;
  isDefault: boolean;
};

function makeTx() {
  const accounts: AccountRow[] = [];
  const taxRates: { companyId: string | null; code: string }[] = [];
  const periods: { fiscalYear: number; periodNumber: number }[] = [];
  const defaults: { accountRole: AccountRole; accountId: string }[] = [];
  let accountSeq = 0;

  const systemTaxTemplates: TaxTemplate[] = [
    {
      id: "t-std",
      companyId: null,
      name: "Standard 18%",
      code: "VAT_STANDARD",
      rate: 18,
      calculationType: "EXCLUSIVE",
      scope: "BOTH",
      isDefault: true,
    },
    {
      id: "t-red",
      companyId: null,
      name: "Reduced 8%",
      code: "VAT_REDUCED",
      rate: 8,
      calculationType: "EXCLUSIVE",
      scope: "BOTH",
      isDefault: false,
    },
  ];

  const tx = {
    taxRate: {
      findMany: ({ where }: { where: { companyId: null } }) =>
        where.companyId === null ? Promise.resolve(systemTaxTemplates) : Promise.resolve([]),
      createMany: ({ data }: { data: { companyId: string; code: string }[] }) => {
        taxRates.push(...data);
        return Promise.resolve({ count: data.length });
      },
    },
    account: {
      createMany: ({ data }: { data: { companyId: string; code: string }[] }) => {
        for (const d of data) {
          accounts.push({ id: `a-${++accountSeq}`, companyId: d.companyId, code: d.code });
        }
        return Promise.resolve({ count: data.length });
      },
      findMany: ({ where }: { where: { companyId: string } }) =>
        Promise.resolve(accounts.filter((a) => a.companyId === where.companyId)),
    },
    accountingPeriod: {
      createMany: ({ data }: { data: { fiscalYear: number; periodNumber: number }[] }) => {
        periods.push(...data);
        return Promise.resolve({ count: data.length });
      },
    },
    companyAccountDefaults: {
      createMany: ({ data }: { data: { accountRole: AccountRole; accountId: string }[] }) => {
        defaults.push(...data);
        return Promise.resolve({ count: data.length });
      },
    },
  };

  return { tx, accounts, taxRates, periods, defaults };
}

describe("CompanySetupService.seedDefaults", () => {
  const companyId = "co-1";
  const userId = "u-1";

  it("copies system tax-rate templates and tags them with the company id", async () => {
    const { tx, taxRates } = makeTx();
    await new CompanySetupService().seedDefaults(tx as never, {
      companyId,
      createdBy: userId,
      fiscalYearStartMonth: 1,
      fiscalYear: 2026,
    });
    expect(taxRates).toHaveLength(2);
    expect(taxRates.every((t) => t.companyId === companyId)).toBe(true);
  });

  it("seeds every account from the default chart", async () => {
    const { tx, accounts } = makeTx();
    await new CompanySetupService().seedDefaults(tx as never, {
      companyId,
      createdBy: userId,
      fiscalYearStartMonth: 1,
      fiscalYear: 2026,
    });
    expect(accounts).toHaveLength(DEFAULT_CHART_OF_ACCOUNTS.length);
    const codes = new Set(accounts.map((a) => a.code));
    for (const a of DEFAULT_CHART_OF_ACCOUNTS) expect(codes.has(a.code)).toBe(true);
  });

  it("generates 12 periods for the given fiscal year", async () => {
    const { tx, periods } = makeTx();
    await new CompanySetupService().seedDefaults(tx as never, {
      companyId,
      createdBy: userId,
      fiscalYearStartMonth: 7,
      fiscalYear: 2026,
    });
    expect(periods).toHaveLength(12);
    expect(periods.every((p) => p.fiscalYear === 2026)).toBe(true);
    expect(periods.map((p) => p.periodNumber).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("populates CompanyAccountDefaults pointing at the expected account codes", async () => {
    const { tx, accounts, defaults } = makeTx();
    await new CompanySetupService().seedDefaults(tx as never, {
      companyId,
      createdBy: userId,
      fiscalYearStartMonth: 1,
      fiscalYear: 2026,
    });
    expect(defaults).toHaveLength(Object.keys(DEFAULT_ACCOUNT_ROLE_CODES).length);
    for (const [role, code] of Object.entries(DEFAULT_ACCOUNT_ROLE_CODES) as [
      AccountRole,
      string,
    ][]) {
      const def = defaults.find((d) => d.accountRole === role);
      expect(def).toBeDefined();
      const account = accounts.find((a) => a.id === def?.accountId);
      expect(account?.code).toBe(code);
    }
  });
});
