"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface AccountStub {
  id: string;
  code: string;
  name: string;
  accountType: string;
  normalBalance: string;
}

export interface TrialBalanceResponse {
  from: string;
  to: string;
  lines: (AccountStub & {
    accountId: string;
    debit: string;
    credit: string;
  })[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

export interface GeneralLedgerResponse {
  account: AccountStub;
  from: string;
  to: string;
  openingBalance: string;
  lines: {
    entryId: string;
    entryNumber: string | null;
    entryDate: string;
    sourceDocumentType: string | null;
    description: string | null;
    debit: string;
    credit: string;
    runningBalance: string;
  }[];
  closingBalance: string;
}

export interface PnlResponse {
  from: string;
  to: string;
  revenue: { accountId: string; code: string; name: string; amount: string }[];
  expenses: { accountId: string; code: string; name: string; amount: string }[];
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
}

export interface BalanceSheetResponse {
  asOf: string;
  assets: { accountId: string; code: string; name: string; amount: string }[];
  liabilities: { accountId: string; code: string; name: string; amount: string }[];
  equity: { accountId: string | null; code: string; name: string; amount: string }[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  balanced: boolean;
}

export interface ArAgingResponse {
  asOf: string;
  rows: {
    contactId: string;
    contactName: string;
    current: string;
    "1-30": string;
    "31-60": string;
    "61-90": string;
    "91+": string;
    total: string;
    invoices: {
      invoiceNumber: string | null;
      dueDate: string;
      balanceDue: string;
      bucket: string;
    }[];
  }[];
  totals: {
    current: string;
    "1-30": string;
    "31-60": string;
    "61-90": string;
    "91+": string;
    total: string;
  };
}

export function useTrialBalance(from: string, to: string) {
  return useQuery({
    queryKey: ["reports", "trial-balance", from, to],
    queryFn: () => apiFetch<TrialBalanceResponse>(`/reports/trial-balance?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
}

export function useGeneralLedger(accountId: string, from: string, to: string) {
  return useQuery({
    queryKey: ["reports", "general-ledger", accountId, from, to],
    queryFn: () =>
      apiFetch<GeneralLedgerResponse>(
        `/reports/general-ledger?accountId=${accountId}&from=${from}&to=${to}`,
      ),
    enabled: !!accountId && !!from && !!to,
  });
}

export function useProfitAndLoss(from: string, to: string) {
  return useQuery({
    queryKey: ["reports", "p&l", from, to],
    queryFn: () => apiFetch<PnlResponse>(`/reports/profit-and-loss?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
}

export function useBalanceSheet(asOf: string) {
  return useQuery({
    queryKey: ["reports", "balance-sheet", asOf],
    queryFn: () => apiFetch<BalanceSheetResponse>(`/reports/balance-sheet?asOf=${asOf}`),
    enabled: !!asOf,
  });
}

export function useArAging(asOf: string) {
  return useQuery({
    queryKey: ["reports", "ar-aging", asOf],
    queryFn: () =>
      apiFetch<ArAgingResponse>(asOf ? `/reports/ar-aging?asOf=${asOf}` : "/reports/ar-aging"),
  });
}

export interface ApAgingResponse {
  asOf: string;
  rows: {
    contactId: string;
    contactName: string;
    current: string;
    "1-30": string;
    "31-60": string;
    "61-90": string;
    "91+": string;
    total: string;
    bills: {
      billNumber: string;
      dueDate: string;
      balanceDue: string;
      bucket: string;
    }[];
  }[];
  totals: {
    current: string;
    "1-30": string;
    "31-60": string;
    "61-90": string;
    "91+": string;
    total: string;
  };
}

export function useApAging(asOf: string) {
  return useQuery({
    queryKey: ["reports", "ap-aging", asOf],
    queryFn: () =>
      apiFetch<ApAgingResponse>(asOf ? `/reports/ap-aging?asOf=${asOf}` : "/reports/ap-aging"),
  });
}
