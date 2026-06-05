"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { useT } from "@/i18n/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  useAccounts,
  useCreateAccount,
  useDeactivateAccount,
  useUpdateAccount,
} from "@/lib/queries/accounts";
import {
  ACCOUNT_TYPES,
  NORMAL_BALANCES,
  type Account,
  type AccountType,
  type NormalBalance,
} from "@/lib/types";

const ACCOUNT_TYPE_VALUES = ACCOUNT_TYPES.map((t) => t.value) as [AccountType, ...AccountType[]];
const NORMAL_BALANCE_VALUES = NORMAL_BALANCES.map((t) => t.value) as [
  NormalBalance,
  ...NormalBalance[],
];

const Schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  accountType: z.enum(ACCOUNT_TYPE_VALUES),
  normalBalance: z.enum(NORMAL_BALANCE_VALUES),
  accountSubtype: z.string().max(50).optional().or(z.literal("")),
  parentAccountId: z.string().uuid().optional().or(z.literal("")),
  isPostable: z.boolean().default(true),
});
type Values = z.infer<typeof Schema>;

export function AccountsClient() {
  const t = useT();
  const { data, isLoading } = useAccounts();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | AccountType>("all");

  const filtered = (data ?? []).filter((a) => typeFilter === "all" || a.accountType === typeFilter);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Label htmlFor="typeFilter">{t("accounts.filterByType")}</Label>
              <Select
                id="typeFilter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as never)}
              >
                <option value="all">{t("common.all")}</option>
                {ACCOUNT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setShowNew((v) => !v);
              }}
            >
              {showNew ? t("common.cancel") : t("accounts.newAccountButton")}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <AccountForm
          onDone={() => setShowNew(false)}
          onCancel={() => setShowNew(false)}
          existingAccounts={data ?? []}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>{t("common.code")}</Th>
                <Th>{t("common.name")}</Th>
                <Th>{t("common.type")}</Th>
                <Th>{t("accounts.normalBalance")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    {t("accounts.empty")}
                  </td>
                </tr>
              ) : (
                filtered.map((a) =>
                  editing?.id === a.id ? (
                    <tr key={a.id}>
                      <td colSpan={5} className="p-4">
                        <AccountForm
                          initial={a}
                          onDone={() => setEditing(null)}
                          onCancel={() => setEditing(null)}
                          existingAccounts={data ?? []}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={a.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <Td className="font-mono text-xs">{a.code}</Td>
                      <Td>
                        <div className="font-medium">{a.name}</div>
                        <div className="flex gap-1 pt-1">
                          {a.isSystem ? <Badge variant="warning">{t("accounts.badgeSystem")}</Badge> : null}
                          {!a.isPostable ? <Badge variant="outline">{t("accounts.badgeRollUp")}</Badge> : null}
                          {!a.isActive ? <Badge>{t("accounts.badgeInactive")}</Badge> : null}
                        </div>
                      </Td>
                      <Td>{t(`enums.accountType.${a.accountType}`)}</Td>
                      <Td>{t(`enums.normalBalance.${a.normalBalance}`)}</Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                          {t("accounts.edit")}
                        </Button>
                      </Td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
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
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function AccountForm({
  initial,
  existingAccounts,
  onDone,
  onCancel,
}: {
  initial?: Account;
  existingAccounts: Account[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const create = useCreateAccount();
  const update = useUpdateAccount(initial?.id ?? "");
  const deactivate = useDeactivateAccount();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema) as Resolver<Values>,
    defaultValues: {
      code: initial?.code ?? "",
      name: initial?.name ?? "",
      accountType: (initial?.accountType ?? "ASSET") as AccountType,
      normalBalance: (initial?.normalBalance ?? "DEBIT") as NormalBalance,
      accountSubtype: initial?.accountSubtype ?? "",
      parentAccountId: initial?.parentAccountId ?? "",
      isPostable: initial?.isPostable ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
    );
    try {
      if (initial) await update.mutateAsync(payload as never);
      else await create.mutateAsync(payload as never);
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("accounts.saveFailed"));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial ? t("accounts.editAccount") : t("accounts.newAccount")}</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="code">{t("accounts.codeLabel")}</Label>
              <Input id="code" invalid={!!errors.code} {...register("code")} />
              <FormError message={errors.code?.message} />
            </div>
            <div>
              <Label htmlFor="name">{t("accounts.nameLabel")}</Label>
              <Input id="name" invalid={!!errors.name} {...register("name")} />
              <FormError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="accountType">{t("accounts.typeLabel")}</Label>
              <Select id="accountType" {...register("accountType")}>
                {ACCOUNT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="normalBalance">{t("accounts.normalBalanceLabel")}</Label>
              <Select id="normalBalance" {...register("normalBalance")}>
                {NORMAL_BALANCES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="accountSubtype">{t("accounts.subtype")}</Label>
              <Input id="accountSubtype" {...register("accountSubtype")} />
            </div>
            <div>
              <Label htmlFor="parentAccountId">{t("accounts.parentAccount")}</Label>
              <Select id="parentAccountId" {...register("parentAccountId")}>
                <option value="">{t("accounts.parentNone")}</option>
                {existingAccounts
                  .filter((a) => a.id !== initial?.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <input
                id="isPostable"
                type="checkbox"
                className="h-4 w-4"
                {...register("isPostable")}
              />
              <Label htmlFor="isPostable">{t("accounts.postable")}</Label>
            </div>
          </div>

          <FormError message={submitError ?? undefined} />

          {initial && !initial.isSystem ? (
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
              <span className="text-zinc-600 dark:text-zinc-400">
                {t("accounts.deactivateHint")}
              </span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (!confirm(t("accounts.deactivateConfirm"))) return;
                  try {
                    await deactivate.mutateAsync(initial.id);
                    onDone();
                  } catch (err) {
                    setSubmitError(
                      err instanceof Error ? err.message : t("accounts.deactivateFailed"),
                    );
                  }
                }}
              >
                {t("accounts.deactivate")}
              </Button>
            </div>
          ) : null}
          {initial?.isSystem ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              {t("accounts.systemAccountNotice")}
            </div>
          ) : null}
        </CardContent>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending || update.isPending}>
            {initial ? t("common.save") : t("accounts.create")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
