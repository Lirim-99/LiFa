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
import { useT } from "@/i18n/client";
import {
  useAddCompanyUser,
  useCompanyUsers,
  useRemoveCompanyUser,
  useUpdateCompanyUser,
  type CompanyUser,
} from "@/lib/queries/company-users";
import { ROLE_CODES, type RoleCode } from "@/lib/types";

const AddSchema = z.object({
  email: z.string().email(),
  roleCode: z.enum(ROLE_CODES),
});
type AddValues = z.infer<typeof AddSchema>;

export function UsersClient({ companyId }: { companyId: string }) {
  const t = useT();
  const { data: users, isLoading } = useCompanyUsers(companyId);
  const add = useAddCompanyUser(companyId);
  const update = useUpdateCompanyUser(companyId);
  const remove = useRemoveCompanyUser(companyId);
  const [showAdd, setShowAdd] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddValues>({
    resolver: zodResolver(AddSchema),
    defaultValues: { email: "", roleCode: "accountant" },
  });

  const onAdd = handleSubmit(async (values) => {
    setActionError(null);
    try {
      await add.mutateAsync(values);
      reset();
      setShowAdd(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("users.failedToAdd"));
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? t("common.cancel") : t("users.inviteUserButton")}
        </Button>
      </div>

      {showAdd ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("users.inviteUser")}</CardTitle>
          </CardHeader>
          <form onSubmit={onAdd} noValidate>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="email">{t("users.emailLabel")}</Label>
                  <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
                  <FormError message={errors.email?.message} />
                  <p className="mt-1 text-xs text-zinc-500">{t("users.accountHelper")}</p>
                </div>
                <div>
                  <Label htmlFor="roleCode">{t("users.roleLabel")}</Label>
                  <Select id="roleCode" {...register("roleCode")}>
                    {ROLE_CODES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <FormError message={actionError ?? undefined} />
            </CardContent>
            <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting || add.isPending}>
                {t("users.invite")}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>{t("common.name")}</Th>
                <Th>{t("common.email")}</Th>
                <Th>{t("users.role")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : !users || users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    {t("users.empty")}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <Row
                    key={u.userId}
                    user={u}
                    onChangeRole={async (role) => {
                      setActionError(null);
                      try {
                        await update.mutateAsync({ userId: u.userId, roleCode: role });
                      } catch (err) {
                        setActionError(err instanceof Error ? err.message : t("users.failed"));
                      }
                    }}
                    onRemove={async () => {
                      if (!confirm(t("users.confirmRemove", { email: u.email }))) return;
                      setActionError(null);
                      try {
                        await remove.mutateAsync(u.userId);
                      } catch (err) {
                        setActionError(err instanceof Error ? err.message : t("users.failed"));
                      }
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <FormError message={actionError ?? undefined} />
    </div>
  );
}

function Row({
  user,
  onChangeRole,
  onRemove,
}: {
  user: CompanyUser;
  onChangeRole: (role: RoleCode) => void;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <Td>
        {user.firstName} {user.lastName}
        {user.isDefault ? (
          <Badge variant="outline" className="ml-2 text-[10px]">
            {t("users.default")}
          </Badge>
        ) : null}
      </Td>
      <Td>{user.email}</Td>
      <Td>
        <Select
          value={user.roleCode}
          onChange={(e) => onChangeRole(e.target.value as RoleCode)}
          className="w-36"
        >
          {ROLE_CODES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Td>
      <Td className="text-right">
        <Button size="sm" variant="ghost" onClick={onRemove}>
          {t("users.remove")}
        </Button>
      </Td>
    </tr>
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
