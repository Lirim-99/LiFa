"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

const Schema = z.object({
  activityType: z.enum(ACTIVITY_TYPE_VALUES),
  code: z.string().min(1, "Required").max(20),
  description: z.string().max(500).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
type Values = z.infer<typeof Schema>;

export function ActivityCodesSection({ companyId }: { companyId: string }) {
  const { data, isLoading } = useCompanyActivityCodes(companyId);
  const [editing, setEditing] = useState<CompanyActivityCode | null>(null);
  const [showNew, setShowNew] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Activity codes</CardTitle>
            <CardDescription>NACE Rev. 2 — primary and secondary.</CardDescription>
          </div>
          {!showNew && !editing ? (
            <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>
              + Add code
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

        {isLoading ? <p className="text-sm text-zinc-500">Loading…</p> : null}

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
          <p className="text-sm text-zinc-500">No activity codes yet.</p>
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
  const del = useDeleteActivityCode(companyId);
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <Badge variant={code.activityType === "PRIMARY" ? "success" : "outline"}>
          {code.activityType}
        </Badge>
        <span className="font-mono text-sm">{code.code}</span>
        {code.description ? (
          <span className="text-sm text-zinc-500">{code.description}</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm("Delete this activity code?")) void del.mutate(code.id);
          }}
        >
          Delete
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
  const create = useCreateActivityCode(companyId);
  const update = useUpdateActivityCode(companyId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema),
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
        await update.mutateAsync({ id: initial.id, ...(payload as never) });
      } else {
        await create.mutateAsync(payload as never);
      }
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
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
          <Label htmlFor="activityType">Type</Label>
          <Select id="activityType" {...register("activityType")}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="code">Code</Label>
          <Input id="code" invalid={!!errors.code} {...register("code")} />
          <FormError message={errors.code?.message} />
        </div>
        <div>
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            type="number"
            min={0}
            {...register("sortOrder", { valueAsNumber: true })}
          />
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={2} {...register("description")} />
        </div>
      </div>
      <FormError message={submitError ?? undefined} />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting || create.isPending || update.isPending}>
          {initial ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
