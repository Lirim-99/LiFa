"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAccounts } from "@/lib/queries/accounts";
import {
  useCreateJournalEntry,
  useDeleteJournalEntry,
  useJournalEntry,
  usePostJournalEntry,
  useUpdateJournalEntry,
  useVoidJournalEntry,
} from "@/lib/queries/journal-entries";

const LineSchema = z.object({
  accountId: z.string().uuid("Pick an account"),
  description: z.string().max(500).optional().or(z.literal("")),
  debitAmount: z.coerce.number().min(0),
  creditAmount: z.coerce.number().min(0),
});
const Schema = z.object({
  entryDate: z.string().min(1),
  memo: z.string().max(500).optional().or(z.literal("")),
  lines: z.array(LineSchema).min(2),
});
type Values = z.infer<typeof Schema>;

export function JournalEntryEditor({
  id,
  onDone,
  onCancel,
}: {
  id?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: existing } = useJournalEntry(id);
  const create = useCreateJournalEntry();
  const update = useUpdateJournalEntry(id ?? "");
  const post = usePostJournalEntry();
  const voidEntry = useVoidJournalEntry();
  const del = useDeleteJournalEntry();
  const { data: accounts } = useAccounts();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDraft = !existing || existing.status === "DRAFT";
  const isManual = !existing || existing.sourceDocumentType === "MANUAL";
  const canEdit = isDraft && isManual;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      entryDate: today(),
      memo: "",
      lines: [
        { accountId: "", description: "", debitAmount: 0, creditAmount: 0 },
        { accountId: "", description: "", debitAmount: 0, creditAmount: 0 },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  useEffect(() => {
    if (!existing) return;
    reset({
      entryDate: existing.entryDate.slice(0, 10),
      memo: existing.memo ?? "",
      lines:
        existing.lines && existing.lines.length > 0
          ? existing.lines.map((l) => ({
              accountId: l.accountId,
              description: l.description ?? "",
              debitAmount: Number(l.debitAmount),
              creditAmount: Number(l.creditAmount),
            }))
          : [
              { accountId: "", description: "", debitAmount: 0, creditAmount: 0 },
              { accountId: "", description: "", debitAmount: 0, creditAmount: 0 },
            ],
    });
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = {
      entryDate: values.entryDate,
      memo: values.memo || undefined,
      lines: values.lines.map((l) => ({
        accountId: l.accountId,
        description: l.description || undefined,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
      })),
    };
    try {
      if (existing) await update.mutateAsync(payload);
      else await create.mutateAsync(payload);
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {existing
              ? existing.entryNumber
                ? `Entry ${existing.entryNumber}`
                : "Draft journal entry"
              : "New journal entry"}
          </CardTitle>
          {existing ? (
            <div className="flex gap-2">
              <Badge variant={existing.status === "POSTED" ? "success" : "warning"}>
                {existing.status}
              </Badge>
              {existing.reversedByEntryId ? <Badge variant="danger">reversed</Badge> : null}
              {existing.sourceDocumentType !== "MANUAL" ? (
                <Badge variant="outline">{existing.sourceDocumentType}</Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="entryDate">Entry date *</Label>
              <Input id="entryDate" type="date" disabled={!canEdit} {...register("entryDate")} />
            </div>
            <div>
              <Label htmlFor="memo">Memo</Label>
              <Input id="memo" disabled={!canEdit} {...register("memo")} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-800">
                <tr className="text-left">
                  <th className="py-2 text-xs uppercase text-zinc-500">Account</th>
                  <th className="py-2 text-xs uppercase text-zinc-500">Description</th>
                  <th className="py-2 text-right text-xs uppercase text-zinc-500">Debit</th>
                  <th className="py-2 text-right text-xs uppercase text-zinc-500">Credit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, idx) => (
                  <tr
                    key={field.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="py-2 pr-2">
                      <Select
                        disabled={!canEdit}
                        invalid={!!errors.lines?.[idx]?.accountId}
                        {...register(`lines.${idx}.accountId`)}
                      >
                        <option value="">—</option>
                        {(accounts ?? [])
                          .filter((a) => a.isPostable)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-2">
                      <Input disabled={!canEdit} {...register(`lines.${idx}.description`)} />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        disabled={!canEdit}
                        className="text-right"
                        {...register(`lines.${idx}.debitAmount`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        disabled={!canEdit}
                        className="text-right"
                        {...register(`lines.${idx}.creditAmount`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="py-2">
                      {canEdit && fields.length > 2 ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => remove(idx)}>
                          ×
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <Totals control={control} />
              </tfoot>
            </table>
          </div>

          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                append({ accountId: "", description: "", debitAmount: 0, creditAmount: 0 })
              }
            >
              + Add line
            </Button>
          ) : null}

          <FormError message={submitError ?? errors.lines?.message} />
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <div className="flex gap-2">
            {existing && existing.status === "DRAFT" && existing.sourceDocumentType === "MANUAL" ? (
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  if (!confirm("Delete this draft?")) return;
                  await del.mutateAsync(existing.id);
                  onDone();
                }}
              >
                Delete draft
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            {canEdit ? (
              <>
                <Button
                  type="submit"
                  loading={isSubmitting || create.isPending || update.isPending}
                >
                  {existing ? "Save" : "Create draft"}
                </Button>
                {existing ? (
                  <Button
                    type="button"
                    onClick={async () => {
                      setSubmitError(null);
                      try {
                        await post.mutateAsync(existing.id);
                        onDone();
                      } catch (err) {
                        setSubmitError(err instanceof Error ? err.message : "Failed");
                      }
                    }}
                    loading={post.isPending}
                  >
                    Post
                  </Button>
                ) : null}
              </>
            ) : null}
            {existing &&
            existing.status === "POSTED" &&
            existing.sourceDocumentType === "MANUAL" &&
            !existing.reversedByEntryId ? (
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  if (!confirm("Create a reversal entry?")) return;
                  setSubmitError(null);
                  try {
                    await voidEntry.mutateAsync(existing.id);
                    onDone();
                  } catch (err) {
                    setSubmitError(err instanceof Error ? err.message : "Failed");
                  }
                }}
                loading={voidEntry.isPending}
              >
                Void
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function Totals({ control }: { control: Control<Values> }) {
  const lines = useWatch({ control, name: "lines" }) ?? [];
  const totals = useMemo(() => {
    let d = 0,
      c = 0;
    for (const l of lines) {
      d += Number(l.debitAmount) || 0;
      c += Number(l.creditAmount) || 0;
    }
    return { d, c, diff: d - c };
  }, [lines]);
  const balanced = Math.abs(totals.diff) < 0.00005;
  return (
    <tr className="font-medium">
      <td colSpan={2} className="pt-2 text-right text-xs uppercase text-zinc-500">
        Totals
      </td>
      <td className="pt-2 text-right">{totals.d.toFixed(4)}</td>
      <td className="pt-2 text-right">{totals.c.toFixed(4)}</td>
      <td className="pt-2 text-right">
        <Badge variant={balanced ? "success" : "danger"}>
          {balanced ? "Balanced" : `Δ ${totals.diff.toFixed(4)}`}
        </Badge>
      </td>
    </tr>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
