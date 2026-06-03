"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const ACCOUNT_TYPE_VALUES = ACCOUNT_TYPES.map((t) => t.value) as [
  AccountType,
  ...AccountType[],
];
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
  const { data, isLoading } = useAccounts();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | AccountType>("all");

  const filtered = (data ?? []).filter(
    (a) => typeFilter === "all" || a.accountType === typeFilter,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Label htmlFor="typeFilter">Filter by type</Label>
              <Select
                id="typeFilter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as never)}
              >
                <option value="all">All</option>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
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
              {showNew ? "Cancel" : "+ New account"}
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
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Normal balance</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No accounts.
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
                          {a.isSystem ? <Badge variant="warning">System</Badge> : null}
                          {!a.isPostable ? <Badge variant="outline">Roll-up</Badge> : null}
                          {!a.isActive ? <Badge>Inactive</Badge> : null}
                        </div>
                      </Td>
                      <Td>{a.accountType}</Td>
                      <Td>{a.normalBalance}</Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                          Edit
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
    <th className={`px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${className}`}>
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
  const create = useCreateAccount();
  const update = useUpdateAccount(initial?.id ?? "");
  const deactivate = useDeactivateAccount();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema),
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
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial ? "Edit account" : "New account"}</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="code">Code *</Label>
              <Input id="code" invalid={!!errors.code} {...register("code")} />
              <FormError message={errors.code?.message} />
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" invalid={!!errors.name} {...register("name")} />
              <FormError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="accountType">Type *</Label>
              <Select id="accountType" {...register("accountType")}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="normalBalance">Normal balance *</Label>
              <Select id="normalBalance" {...register("normalBalance")}>
                {NORMAL_BALANCES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="accountSubtype">Subtype</Label>
              <Input id="accountSubtype" {...register("accountSubtype")} />
            </div>
            <div>
              <Label htmlFor="parentAccountId">Parent account</Label>
              <Select id="parentAccountId" {...register("parentAccountId")}>
                <option value="">— none —</option>
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
              <input id="isPostable" type="checkbox" className="h-4 w-4" {...register("isPostable")} />
              <Label htmlFor="isPostable">Postable (uncheck for roll-up)</Label>
            </div>
          </div>

          <FormError message={submitError ?? undefined} />

          {initial && !initial.isSystem ? (
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
              <span className="text-zinc-600 dark:text-zinc-400">
                Deactivate this account. Refused if posted journal lines reference it.
              </span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (!confirm("Deactivate this account?")) return;
                  try {
                    await deactivate.mutateAsync(initial.id);
                    onDone();
                  } catch (err) {
                    setSubmitError(err instanceof Error ? err.message : "Failed to deactivate");
                  }
                }}
              >
                Deactivate
              </Button>
            </div>
          ) : null}
          {initial?.isSystem ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              This is a system account. It cannot be deactivated.
            </div>
          ) : null}
        </CardContent>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending || update.isPending}>
            {initial ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
