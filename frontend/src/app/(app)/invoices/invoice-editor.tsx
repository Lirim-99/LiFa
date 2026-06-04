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
import { Textarea } from "@/components/ui/textarea";
import { useAccounts } from "@/lib/queries/accounts";
import { useCatalog } from "@/lib/queries/catalog";
import { useContacts } from "@/lib/queries/contacts";
import {
  useDeleteInvoice,
  useInvoice,
  useIssueInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useVoidInvoice,
} from "@/lib/queries/invoices";
import { useTaxRates } from "@/lib/queries/tax";
import { DISCOUNT_TYPES, type DiscountType } from "@/lib/types";

const LineSchema = z.object({
  productServiceId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional().or(z.literal("")),
  discountValue: z.coerce.number().min(0).optional(),
  taxRateId: z.string().uuid().optional().or(z.literal("")),
  incomeAccountId: z.string().uuid().optional().or(z.literal("")),
});

const Schema = z.object({
  contactId: z.string().uuid("Pick a customer"),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  notes: z.string().max(1000).optional().or(z.literal("")),
  lines: z.array(LineSchema).min(1),
});
type Values = z.infer<typeof Schema>;

export function InvoiceEditor({
  id,
  onDone,
  onCancel,
}: {
  id?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: existing } = useInvoice(id);
  const create = useCreateInvoice();
  const update = useUpdateInvoice(id ?? "");
  const issue = useIssueInvoice();
  const voidInv = useVoidInvoice();
  const del = useDeleteInvoice();
  const { data: contactsResp } = useContacts({ limit: 200, isCustomer: true, isActive: true });
  const { data: taxRates } = useTaxRates();
  const { data: accounts } = useAccounts();
  const { data: catalogResp } = useCatalog({ limit: 200, isActive: true });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDraft = !existing || existing.status === "DRAFT";

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      contactId: "",
      issueDate: today(),
      dueDate: today(30),
      notes: "",
      lines: [emptyLine()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  useEffect(() => {
    if (!existing) return;
    reset({
      contactId: existing.contactId,
      issueDate: existing.issueDate.slice(0, 10),
      dueDate: existing.dueDate.slice(0, 10),
      notes: existing.notes ?? "",
      lines:
        existing.lines && existing.lines.length > 0
          ? existing.lines.map((l) => ({
              productServiceId: l.productServiceId ?? "",
              description: l.description ?? "",
              quantity: Number(l.quantity),
              unitPrice: Number(l.unitPrice),
              discountType: (l.discountType ?? "") as DiscountType | "",
              discountValue: l.discountValue ? Number(l.discountValue) : undefined,
              taxRateId: l.taxRateId ?? "",
              incomeAccountId: l.incomeAccountId ?? "",
            }))
          : [emptyLine()],
    });
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = {
      contactId: values.contactId,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      notes: values.notes || undefined,
      lines: values.lines.map((l) => ({
        productServiceId: l.productServiceId || undefined,
        description: l.description || undefined,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountType: l.discountType || undefined,
        discountValue: l.discountType ? l.discountValue : undefined,
        taxRateId: l.taxRateId || undefined,
        incomeAccountId: l.incomeAccountId || undefined,
      })),
    };
    try {
      if (existing) await update.mutateAsync(payload as never);
      else await create.mutateAsync(payload as never);
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
              ? existing.invoiceNumber
                ? `Invoice ${existing.invoiceNumber}`
                : "Draft invoice"
              : "New invoice"}
          </CardTitle>
          {existing ? <Badge>{existing.status}</Badge> : null}
        </div>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label htmlFor="contactId">Customer *</Label>
              <Select
                id="contactId"
                disabled={!isDraft}
                invalid={!!errors.contactId}
                {...register("contactId")}
              >
                <option value="">— Pick a customer —</option>
                {(contactsResp?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </Select>
              <FormError message={errors.contactId?.message} />
            </div>
            <div>
              <Label htmlFor="issueDate">Issue date *</Label>
              <Input id="issueDate" type="date" disabled={!isDraft} {...register("issueDate")} />
            </div>
            <div>
              <Label htmlFor="dueDate">Due date *</Label>
              <Input id="dueDate" type="date" disabled={!isDraft} {...register("dueDate")} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-800">
                <tr className="text-left">
                  <th className="py-2 text-xs uppercase text-zinc-500">Product</th>
                  <th className="py-2 text-xs uppercase text-zinc-500">Description</th>
                  <th className="py-2 text-right text-xs uppercase text-zinc-500">Qty</th>
                  <th className="py-2 text-right text-xs uppercase text-zinc-500">Unit price</th>
                  <th className="py-2 text-xs uppercase text-zinc-500">Discount</th>
                  <th className="py-2 text-xs uppercase text-zinc-500">Tax</th>
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
                      <Select disabled={!isDraft} {...register(`lines.${idx}.productServiceId`)}>
                        <option value="">—</option>
                        {(catalogResp?.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-2">
                      <Input disabled={!isDraft} {...register(`lines.${idx}.description`)} />
                    </td>
                    <td className="py-2 pr-2 w-24">
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        disabled={!isDraft}
                        className="text-right"
                        {...register(`lines.${idx}.quantity`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="py-2 pr-2 w-28">
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        disabled={!isDraft}
                        className="text-right"
                        {...register(`lines.${idx}.unitPrice`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="py-2 pr-2 w-44">
                      <div className="flex gap-1">
                        <Select
                          disabled={!isDraft}
                          className="w-20"
                          {...register(`lines.${idx}.discountType`)}
                        >
                          <option value="">—</option>
                          {DISCOUNT_TYPES.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.value === "PERCENTAGE" ? "%" : "$"}
                            </option>
                          ))}
                        </Select>
                        <Input
                          type="number"
                          step="0.0001"
                          min={0}
                          disabled={!isDraft}
                          className="text-right"
                          {...register(`lines.${idx}.discountValue`, {
                            setValueAs: (v) => (v === "" ? undefined : Number(v)),
                          })}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <Select disabled={!isDraft} {...register(`lines.${idx}.taxRateId`)}>
                        <option value="">—</option>
                        {(taxRates ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} ({t.rate}%)
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2">
                      {isDraft && fields.length > 1 ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => remove(idx)}>
                          ×
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <Totals control={control} taxRates={taxRates ?? []} />
              </tfoot>
            </table>
          </div>

          {isDraft ? (
            <div className="flex items-center justify-between">
              <Button type="button" size="sm" variant="ghost" onClick={() => append(emptyLine())}>
                + Add line
              </Button>
              <details className="text-xs text-zinc-500">
                <summary className="cursor-pointer">Override income account per line</summary>
                <div className="mt-2 space-y-2">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <span className="w-6 text-right">{idx + 1}.</span>
                      <Select className="flex-1" {...register(`lines.${idx}.incomeAccountId`)}>
                        <option value="">use company default (Sales Revenue)</option>
                        {(accounts ?? [])
                          .filter((a) => a.accountType === "REVENUE")
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ) : null}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} disabled={!isDraft} {...register("notes")} />
          </div>

          <FormError message={submitError ?? undefined} />
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <div>
            {isDraft && existing ? (
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  if (!confirm("Delete this draft invoice?")) return;
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
            {isDraft ? (
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
                      if (
                        !confirm("Issue this invoice? Posts a journal entry and assigns a number.")
                      )
                        return;
                      setSubmitError(null);
                      try {
                        await issue.mutateAsync(existing.id);
                        onDone();
                      } catch (err) {
                        setSubmitError(err instanceof Error ? err.message : "Failed");
                      }
                    }}
                    loading={issue.isPending}
                  >
                    Issue
                  </Button>
                ) : null}
              </>
            ) : null}
            {existing &&
            (existing.status === "ISSUED" ||
              existing.status === "PARTIALLY_PAID" ||
              existing.status === "PAID") &&
            existing.balanceDue === existing.totalAmount ? (
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  if (!confirm("Void this invoice? Posts a reversal journal entry.")) return;
                  setSubmitError(null);
                  try {
                    await voidInv.mutateAsync(existing.id);
                    onDone();
                  } catch (err) {
                    setSubmitError(err instanceof Error ? err.message : "Failed");
                  }
                }}
                loading={voidInv.isPending}
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

function Totals({
  control,
  taxRates,
}: {
  control: Control<Values>;
  taxRates: { id: string; rate: string; calculationType: string }[];
}) {
  const lines = useWatch({ control, name: "lines" }) ?? [];
  const t = useMemo(() => {
    let net = 0,
      tax = 0;
    for (const l of lines) {
      let n = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      if (l.discountType === "PERCENTAGE") n = n * (1 - (Number(l.discountValue) || 0) / 100);
      else if (l.discountType === "FIXED") n = Math.max(0, n - (Number(l.discountValue) || 0));
      const rate = taxRates.find((tr) => tr.id === l.taxRateId);
      if (rate) {
        const r = Number(rate.rate) / 100;
        if (rate.calculationType === "EXCLUSIVE") {
          tax += n * r;
        } else {
          const gross = n;
          n = gross / (1 + r);
          tax += gross - n;
        }
      }
      net += n;
    }
    return { net, tax, total: net + tax };
  }, [lines, taxRates]);

  return (
    <>
      <tr>
        <td colSpan={5} className="pt-2 text-right text-xs uppercase text-zinc-500">
          Subtotal
        </td>
        <td colSpan={2} className="pt-2 text-right font-mono">
          {t.net.toFixed(4)}
        </td>
      </tr>
      <tr>
        <td colSpan={5} className="text-right text-xs uppercase text-zinc-500">
          Tax
        </td>
        <td colSpan={2} className="text-right font-mono">
          {t.tax.toFixed(4)}
        </td>
      </tr>
      <tr className="font-semibold">
        <td colSpan={5} className="pb-2 text-right text-xs uppercase">
          Total
        </td>
        <td colSpan={2} className="pb-2 text-right font-mono">
          {t.total.toFixed(4)}
        </td>
      </tr>
    </>
  );
}

function today(addDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  return d.toISOString().slice(0, 10);
}

function emptyLine() {
  return {
    productServiceId: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    discountType: "" as DiscountType | "",
    discountValue: undefined,
    taxRateId: "",
    incomeAccountId: "",
  };
}
