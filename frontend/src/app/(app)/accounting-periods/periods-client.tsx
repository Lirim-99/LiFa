"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useClosePeriod,
  useGeneratePeriods,
  usePeriods,
  useReopenPeriod,
} from "@/lib/queries/periods";
import type { AccountingPeriod } from "@/lib/types";

export function PeriodsClient() {
  const t = useT();
  const { data, isLoading } = usePeriods();
  const generate = useGeneratePeriods();
  const close = useClosePeriod();
  const reopen = useReopenPeriod();
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear() + 1);
  const [actionError, setActionError] = useState<string | null>(null);

  const byYear = new Map<number, AccountingPeriod[]>();
  for (const p of data ?? []) {
    const arr = byYear.get(p.fiscalYear) ?? [];
    arr.push(p);
    byYear.set(p.fiscalYear, arr);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("periods.generateTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div>
            <Label htmlFor="newYear">{t("periods.fiscalYear")}</Label>
            <Input
              id="newYear"
              type="number"
              min={2000}
              max={2100}
              value={newYear}
              onChange={(e) => setNewYear(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <Button
            onClick={async () => {
              setActionError(null);
              try {
                await generate.mutateAsync(newYear);
              } catch (err) {
                setActionError(err instanceof Error ? err.message : t("periods.actionFailed"));
              }
            }}
            loading={generate.isPending}
          >
            {t("periods.generate")}
          </Button>
          <FormError message={actionError ?? undefined} />
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-zinc-500">{t("common.loading")}</p> : null}

      {years.map((year) => (
        <Card key={year}>
          <CardHeader>
            <CardTitle>{t("periods.fyLabel", { year })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <tr className="text-left">
                  <Th>{t("periods.period")}</Th>
                  <Th>{t("periods.start")}</Th>
                  <Th>{t("periods.end")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th className="text-right">{t("common.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {(byYear.get(year) ?? [])
                  .sort((a, b) => a.periodNumber - b.periodNumber)
                  .map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <Td className="font-mono text-xs">
                        P{String(p.periodNumber).padStart(2, "0")}
                      </Td>
                      <Td>{p.startDate.slice(0, 10)}</Td>
                      <Td>{p.endDate.slice(0, 10)}</Td>
                      <Td>
                        <Badge variant={p.status === "OPEN" ? "success" : "outline"}>
                          {t(`enums.periodStatus.${p.status}`)}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        {p.status === "OPEN" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (!confirm(t("periods.closeConfirm", { period: p.periodNumber })))
                                return;
                              setActionError(null);
                              try {
                                await close.mutateAsync(p.id);
                              } catch (err) {
                                setActionError(
                                  err instanceof Error ? err.message : t("periods.actionFailed"),
                                );
                              }
                            }}
                          >
                            {t("periods.close")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              setActionError(null);
                              try {
                                await reopen.mutateAsync(p.id);
                              } catch (err) {
                                setActionError(
                                  err instanceof Error ? err.message : t("periods.actionFailed"),
                                );
                              }
                            }}
                          >
                            {t("periods.reopen")}
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
