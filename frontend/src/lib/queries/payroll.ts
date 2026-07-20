"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export const payrollKeys = {
  all: ["payroll"] as const,
  employees: () => ["payroll", "employees"] as const,
  runs: () => ["payroll", "runs"] as const,
  run: (id: string) => ["payroll", "runs", id] as const,
};

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  personalNumber: string | null;
  email: string | null;
  position: string | null;
  department: string | null;
  employmentType: string;
  startDate: string;
  grossSalary: string;
  isActive: boolean;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string };
  grossSalary: string;
  pensionEmployee: string;
  pensionEmployer: string;
  incomeTax: string;
  netSalary: string;
  overtimeHours: string;
  overtimeAmount: string;
  bonusAmount: string;
  deductionAmount: string;
}

export interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalGross: string;
  totalNet: string;
  totalTax: string;
  totalPension: string;
  payslips?: Payslip[];
  _count?: { payslips: number };
}

// ===================== Employees =====================

export function useEmployees() {
  return useQuery({
    queryKey: payrollKeys.employees(),
    queryFn: () => apiFetch<Employee[]>("/payroll/employees"),
  });
}

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  personalNumber?: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  employmentType?: string;
  startDate: string;
  grossSalary: number;
  bankAccount?: string;
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) =>
      apiFetch<Employee>("/payroll/employees", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: payrollKeys.employees() }); },
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) =>
      apiFetch<Employee>(`/payroll/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: payrollKeys.employees() }); },
  });
}

// ===================== Payroll Runs =====================

export function usePayrollRuns() {
  return useQuery({
    queryKey: payrollKeys.runs(),
    queryFn: () => apiFetch<PayrollRun[]>("/payroll/runs"),
  });
}

export function usePayrollRun(id: string | undefined) {
  return useQuery({
    queryKey: id ? payrollKeys.run(id) : ["payroll", "runs", "none"],
    queryFn: () => apiFetch<PayrollRun>(`/payroll/runs/${id}`),
    enabled: !!id,
  });
}

export interface PayrollRunInput {
  periodStart: string;
  periodEnd: string;
  adjustments?: { employeeId: string; overtimeHours?: number; bonusAmount?: number; deductionAmount?: number; deductionNotes?: string }[];
}

export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PayrollRunInput) =>
      apiFetch<PayrollRun>("/payroll/runs", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: payrollKeys.all }); },
  });
}

export function useApproveRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<PayrollRun>(`/payroll/runs/${id}/approve`, { method: "POST" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: payrollKeys.all }); },
  });
}

export function useMarkRunPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<PayrollRun>(`/payroll/runs/${id}/mark-paid`, { method: "POST" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: payrollKeys.all }); },
  });
}
