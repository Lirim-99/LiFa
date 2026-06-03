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
import { useContacts } from "@/lib/queries/contacts";
import { useInvoices } from "@/lib/queries/invoices";
import { useCreatePayment } from "@/lib/queries/payments";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";

const Schema = z.object({
  contactId: z.string().uuid("Pick a customer"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]),
  paymentDate: z.string().min(1),
  totalAmount: z.coerce.number().min(0.0001, "Required"),
  referenceNumber: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid(),
        allocatedAmount: z.coerce.number().min(0.0001),
      }),
    )
    .min(1, "Allocate to at least one invoice"),
});
type Values = z.infer<typeof Schema>;

export function PaymentForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const create = useCreatePayment();
  const { data: contactsResp } = useContacts({ limit: 200, isCustomer: true, isActive: true });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      contactId: "",
      paymentMethod: "BANK_TRANSFER" as PaymentMethod,
      paymentDate: today(),
      totalAmount: 0,
      referenceNumber: "",
      notes: "",
      allocations: [],
    },
  });

  const contactId = useWatch({ control, name: "contactId" });
  const { data: invoicesResp } = useInvoices({
    contactId: contactId || undefined,
    status: undefined,
    limit: 100,
  });
  const openInvoices = useMemo(
    () =>
      (invoicesResp?.data ?? []).filter(
        (i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID",
      ),
    [invoicesResp],
  );

  const { fields, append, remove, replace } = useFieldArray({ control, name: "allocations" });

  // When the contact changes, clear allocations.
  useEffect(() => {
    replace([]);
  }, [contactId, replace]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await create.mutateAsync({
        contactId: values.contactId,
        paymentMethod: values.paymentMethod,
        paymentDate: values.paymentDate,
        totalAmount: values.totalAmount,
        referenceNumber: values.referenceNumber || undefined,
        notes: values.notes || undefined,
        allocations: values.allocations,
      });
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to record payment");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record payment</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="contactId">Customer *</Label>
              <Select id="contactId" invalid={!!errors.contactId} {...register("contactId")}>
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
              <Label htmlFor="paymentDate">Date *</Label>
              <Input id="paymentDate" type="date" {...register("paymentDate")} />
            </div>
            <div>
              <Label htmlFor="paymentMethod">Method *</Label>
              <Select id="paymentMethod" {...register("paymentMethod")}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="totalAmount">Total amount *</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.0001"
                min={0.0001}
                {...register("totalAmount", { valueAsNumber: true })}
              />
              <FormError message={errors.totalAmount?.message} />
            </div>
            <div>
              <Label htmlFor="referenceNumber">Reference (optional)</Label>
              <Input id="referenceNumber" {...register("referenceNumber")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} {...register("notes")} />
            </div>
          </div>

          {contactId ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase text-zinc-500">
                  Outstanding invoices · allocate amounts (must sum to total)
                </span>
                {fields.length === 0 && openInvoices.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      for (const inv of openInvoices) {
                        append({ invoiceId: inv.id, allocatedAmount: 0 });
                      }
                    }}
                  >
                    + Add all
                  </Button>
                ) : null}
              </div>
              {openInvoices.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No outstanding invoices for this customer.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200 dark:border-zinc-800">
                    <tr className="text-left">
                      <th className="py-2 text-xs uppercase text-zinc-500">Invoice</th>
                      <th className="py-2 text-right text-xs uppercase text-zinc-500">Total</th>
                      <th className="py-2 text-right text-xs uppercase text-zinc-500">Balance</th>
                      <th className="py-2 text-right text-xs uppercase text-zinc-500">Allocate</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => {
                      const inv = openInvoices.find(
                        (i) => i.id === (field as { invoiceId: string }).invoiceId,
                      );
                      if (!inv) return null;
                      return (
                        <tr
                          key={field.id}
                          className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                        >
                          <td className="py-2 font-mono text-xs">
                            {inv.invoiceNumber ?? "draft"}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {Number(inv.totalAmount).toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {Number(inv.balanceDue).toFixed(2)}
                          </td>
                          <td className="py-2 w-32">
                            <Input
                              type="number"
                              step="0.0001"
                              min={0}
                              max={Number(inv.balanceDue)}
                              className="text-right"
                              {...register(`allocations.${idx}.allocatedAmount`, {
                                valueAsNumber: true,
                              })}
                            />
                          </td>
                          <td className="py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => remove(idx)}
                            >
                              ×
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {openInvoices
                  .filter((inv) => !fields.some((f) => (f as { invoiceId: string }).invoiceId === inv.id))
                  .map((inv) => (
                    <Button
                      key={inv.id}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => append({ invoiceId: inv.id, allocatedAmount: 0 })}
                    >
                      + {inv.invoiceNumber ?? "draft"} ({Number(inv.balanceDue).toFixed(2)})
                    </Button>
                  ))}
              </div>
              <AllocationSummary control={control} />
              <FormError message={errors.allocations?.message} />
            </div>
          ) : null}

          <FormError message={submitError ?? undefined} />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Record payment
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function AllocationSummary({ control }: { control: Control<Values> }) {
  const allocations = useWatch({ control, name: "allocations" }) ?? [];
  const total = useWatch({ control, name: "totalAmount" }) ?? 0;
  const sum = allocations.reduce((acc, a) => acc + (Number(a.allocatedAmount) || 0), 0);
  const diff = (Number(total) || 0) - sum;
  const matched = Math.abs(diff) < 0.00005;
  return (
    <div className="mt-3 flex items-center gap-3 text-sm">
      <span className="text-zinc-500">Allocated:</span>
      <span className="font-mono">{sum.toFixed(4)}</span>
      <span className="text-zinc-400">/</span>
      <span className="font-mono">{Number(total).toFixed(4)}</span>
      <Badge variant={matched ? "success" : "warning"}>
        {matched ? "Matches" : `Δ ${diff.toFixed(4)}`}
      </Badge>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
