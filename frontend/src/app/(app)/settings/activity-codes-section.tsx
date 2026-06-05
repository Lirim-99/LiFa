"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/client";
import {
  useCompanyActivityCodes,
  useCreateActivityCode,
  useDeleteActivityCode,
  useUpdateActivityCode,
} from "@/lib/queries/companies";
import { ACTIVITY_TYPES, type ActivityType, type CompanyActivityCode } from "@/lib/types";

const ACTIVITY_TYPE_VALUES = ACTIVITY_TYPES.map((t) => t.value) as [
  ActivityType,
  ...ActivityType[],
];

export function ActivityCodesSection({ companyId }: { companyId: string }) {
  const t = useT();
  const { data, isLoading } = useCompanyActivityCodes(companyId);
  const [editing, setEditing] = useState<CompanyActivityCode | null>(null);
  const [showNew, setShowNew] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{t("settings.activityCodes.title")}</CardTitle>
            <CardDescription>{t("settings.activityCodes.description")}</CardDescription>
          </div>
          {!showNew && !editing ? (
            <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>
              {t("settings.activityCodes.addCode")}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showNew ? (
          <CodeForm
            companyId={companyId}
            onDone={() => setShowNew(false)}
            onCancel={() => setShowNew(false)}
          />
        ) : null}

        {isLoading ? <p className="text-sm text-zinc-500">{t("common.loading")}</p> : null}

        {(data ?? []).map((c) =>
          editing?.id === c.id ? (
            <CodeForm
              key={c.id}
              companyId={companyId}
              initial={c}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <CodeRow key={c.id} code={c} companyId={companyId} onEdit={() => setEditing(c)} />
          ),
        )}

        {data && data.length === 0 && !showNew ? (
          <p className="text-sm text-zinc-500">{t("settings.activityCodes.empty")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CodeRow({
  code,
  companyId,
  onEdit,
}: {
  code: CompanyActivityCode;
  companyId: string;
  onEdit: () => void;
}) {
  const t = useT();
  const del = useDeleteActivityCode(companyId);
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <Badge variant={code.activityType === "PRIMARY" ? "success" : "outline"}>
          {t(`enums.activityType.${code.activityType}`)}
        </Badge>
        <span className="font-mono text-sm">{code.code}</span>
        {code.description ? (
          <span className="text-sm text-zinc-500">{code.description}</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          {t("settings.activityCodes.edit")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm(t("settings.activityCodes.confirmDelete"))) void del.mutate(code.id);
          }}
        >
          {t("settings.activityCodes.delete")}
        </Button>
      </div>
    </div>
  );
}

function CodeForm({
  companyId,
  initial,
  onDone,
  onCancel,
}: {
  companyId: string;
  initial?: CompanyActivityCode;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const create = useCreateActivityCode(companyId);
  const update = useUpdateActivityCode(companyId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const Schema = z.object({
    activityType: z.enum(ACTIVITY_TYPE_VALUES),
    code: z.string().min(1, t("common.required")).max(20),
    description: z.string().max(500).optional().or(z.literal("")),
    sortOrder: z.coerce.number().int().min(0).default(0),
  });
  type Values = z.infer<typeof Schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema) as Resolver<Values>,
    defaultValues: {
      activityType: (initial?.activityType ?? "PRIMARY") as ActivityType,
      code: initial?.code ?? "",
      description: initial?.description ?? "",
      sortOrder: initial?.sortOrder ?? 0,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
    );
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...payload } as never);
      } else {
        await create.mutateAsync(payload as never);
      }
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("settings.failedToSave"));
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="activityType">{t("common.type")}</Label>
          <Select id="activityType" {...register("activityType")}>
            {ACTIVITY_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="code">{t("common.code")}</Label>
          <Input id="code" invalid={!!errors.code} {...register("code")} />
          <FormError message={errors.code?.message} />
        </div>
        <div>
          <Label htmlFor="sortOrder">{t("settings.activityCodes.sortOrder")}</Label>
          <Input
            id="sortOrder"
            type="number"
            min={0}
            {...register("sortOrder", { valueAsNumber: true })}
          />
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="description">{t("settings.activityCodes.descriptionLabel")}</Label>
          <Textarea id="description" rows={2} {...register("description")} />
        </div>
      </div>
      <FormError message={submitError ?? undefined} />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting || create.isPending || update.isPending}>
          {initial ? t("common.save") : t("settings.activityCodes.add")}
        </Button>
      </div>
    </form>
  );
}
