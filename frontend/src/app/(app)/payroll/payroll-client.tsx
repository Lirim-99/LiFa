"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import {
  useApproveRun,
  useCreateEmployee,
  useCreatePayrollRun,
  useEmployees,
  useMarkRunPaid,
  usePayrollRuns,
  type Employee,
  type PayrollRun,
} from "@/lib/queries/payroll";

type Tab = "employees" | "runs";

export function PayrollClient() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("employees");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("payroll.title")}</h1>
        <p className="text-sm text-zinc-500">{t("payroll.description")}</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={tab === "employees" ? "primary" : "secondary"}
          onClick={() => setTab("employees")}
        >
          {t("payroll.employees")}
        </Button>
        <Button
          size="sm"
          variant={tab === "runs" ? "primary" : "secondary"}
          onClick={() => setTab("runs")}
        >
          {t("payroll.runs")}
        </Button>
      </div>

      {tab === "employees" && <EmployeesTab />}
      {tab === "runs" && <RunsTab />}
    </div>
  );
}

// ===================== Employees Tab =====================

function EmployeesTab() {
  const t = useT();
  const { data: employees, isLoading } = useEmployees();
  const [showForm, setShowForm] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("payroll.employeeList")}</CardTitle>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {t("payroll.addEmployee")}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && <NewEmployeeForm onDone={() => setShowForm(false)} />}

        {isLoading && <p className="text-sm text-zinc-500">{t("common.loading")}</p>}
        {!isLoading && (!employees || employees.length === 0) && (
          <p className="py-6 text-center text-sm text-zinc-400">{t("payroll.noEmployees")}</p>
        )}
        {employees && employees.length > 0 && (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="pb-2 pr-3">{t("payroll.name")}</th>
                <th className="pb-2 pr-3">{t("payroll.position")}</th>
                <th className="pb-2 pr-3">{t("payroll.department")}</th>
                <th className="pb-2 pr-3">{t("payroll.grossSalary")}</th>
                <th className="pb-2">{t("payroll.type")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{e.firstName} {e.lastName}</td>
                  <td className="py-2 pr-3 text-xs">{e.position ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs">{e.department ?? "—"}</td>
                  <td className="py-2 pr-3">&euro;{Number(e.grossSalary).toFixed(2)}</td>
                  <td className="py-2">
                    <Badge variant="outline">{e.employmentType}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function NewEmployeeForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const create = useCreateEmployee();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [grossSalary, setGrossSalary] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = () => {
    if (!firstName || !lastName || !grossSalary) return;
    create.mutate(
      { firstName, lastName, position: position || undefined, grossSalary: Number(grossSalary), startDate },
      { onSuccess: onDone },
    );
  };

  return (
    <div className="mb-4 rounded-lg border p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("payroll.firstName")}</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <Label>{t("payroll.lastName")}</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div>
          <Label>{t("payroll.position")}</Label>
          <Input value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>
        <div>
          <Label>{t("payroll.grossSalary")} (&euro;)</Label>
          <Input type="number" min="0" value={grossSalary} onChange={(e) => setGrossSalary(e.target.value)} />
        </div>
        <div>
          <Label>{t("payroll.startDate")}</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={create.isPending}>{t("common.save")}</Button>
        <Button size="sm" variant="secondary" onClick={onDone}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}

// ===================== Runs Tab =====================

function RunsTab() {
  const t = useT();
  const { data: runs, isLoading } = usePayrollRuns();
  const createRun = useCreatePayrollRun();
  const approveRun = useApproveRun();
  const markPaid = useMarkRunPaid();
  const [showNew, setShowNew] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const handleCreate = () => {
    if (!periodStart || !periodEnd) return;
    createRun.mutate({ periodStart, periodEnd }, { onSuccess: () => setShowNew(false) });
  };

  const STATUS_VARIANT: Record<string, "outline" | "info" | "success"> = {
    DRAFT: "outline",
    APPROVED: "info",
    PAID: "success",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("payroll.payrollRuns")}</CardTitle>
        <Button size="sm" onClick={() => setShowNew((v) => !v)}>{t("payroll.newRun")}</Button>
      </CardHeader>
      <CardContent>
        {showNew && (
          <div className="mb-4 rounded-lg border p-4 flex flex-wrap items-end gap-3">
            <div>
              <Label>{t("payroll.periodStart")}</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>{t("payroll.periodEnd")}</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={createRun.isPending}>{t("payroll.generate")}</Button>
          </div>
        )}

        {isLoading && <p className="text-sm text-zinc-500">{t("common.loading")}</p>}
        {!isLoading && (!runs || runs.length === 0) && (
          <p className="py-6 text-center text-sm text-zinc-400">{t("payroll.noRuns")}</p>
        )}
        {runs && runs.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="pb-2 pr-3">{t("payroll.period")}</th>
                <th className="pb-2 pr-3">{t("payroll.employees")}</th>
                <th className="pb-2 pr-3">{t("payroll.totalGross")}</th>
                <th className="pb-2 pr-3">{t("payroll.totalNet")}</th>
                <th className="pb-2 pr-3">{t("payroll.status")}</th>
                <th className="pb-2">{t("payroll.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-xs">
                    {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-3">{r._count?.payslips ?? "—"}</td>
                  <td className="py-2 pr-3">&euro;{Number(r.totalGross).toFixed(2)}</td>
                  <td className="py-2 pr-3">&euro;{Number(r.totalNet).toFixed(2)}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status}</Badge>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {r.status === "DRAFT" && (
                        <Button size="sm" onClick={() => approveRun.mutate(r.id)}>
                          {t("payroll.approve")}
                        </Button>
                      )}
                      {r.status === "APPROVED" && (
                        <Button size="sm" onClick={() => markPaid.mutate(r.id)}>
                          {t("payroll.markPaid")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
