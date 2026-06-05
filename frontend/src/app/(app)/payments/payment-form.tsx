"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency, formatNumber } from "@/i18n/format";
import type { TranslateFn } from "@/i18n/translate";
import { useContacts } from "@/lib/queries/contacts";
import { useInvoices } from "@/lib/queries/invoices";
import { useCreatePayment } from "@/lib/queries/payments";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";

function makeSchema(t: TranslateFn) {
  return z.object({
    contactId: z.string().uuid(t("payments.pickCustomer")),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]),
    paymentDate: z.string().min(1),
    totalAmount: z.coerce.number().min(0.0001, t("common.required")),
    referenceNumber: z.string().max(100).optional().or(z.literal("")),
    notes: z.string().max(1000).optional().or(z.literal("")),
    allocations: z
      .array(
        z.object({
          invoiceId: z.string().uuid(),
          allocatedAmount: z.coerce.number().min(0.0001),
        }),
      )
      .min(1, t("payments.allocateAtLeastOne")),
  });
}
type Values = z.infer<ReturnType<typeof makeSchema>>;

export function PaymentForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const locale = useLocale();
  const Schema = useMemo(() => makeSchema(t), [t]);
  const create = useCreatePayment();
  const { data: contactsResp } = useContacts({ limit: 200, isCustomer: true, isActive: true });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema) as Resolver<Values>,
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
      setSubmitError(err instanceof Error ? err.message : t("payments.recordFailed"));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("payments.recordPayment")}</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="contactId">{t("payments.customerRequired")}</Label>
              <Select id="contactId" invalid={!!errors.contactId} {...register("contactId")}>
                <option value="">{t("payments.pickCustomerOption")}</option>
                {(contactsResp?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </Select>
              <FormError message={errors.contactId?.message} />
            </div>
            <div>
              <Label htmlFor="paymentDate">{t("payments.dateRequired")}</Label>
              <Input id="paymentDate" type="date" {...register("paymentDate")} />
            </div>
            <div>
              <Label htmlFor="paymentMethod">{t("payments.methodRequired")}</Label>
              <Select id="paymentMethod" {...register("paymentMethod")}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="totalAmount">{t("payments.totalAmountRequired")}</Label>
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
              <Label htmlFor="referenceNumber">{t("payments.referenceOptional")}</Label>
              <Input id="referenceNumber" {...register("referenceNumber")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">{t("payments.notes")}</Label>
              <Textarea id="notes" rows={2} {...register("notes")} />
            </div>
          </div>

          {contactId ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase text-zinc-500">
                  {t("payments.outstandingInvoices")}
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
                    {t("payments.addAll")}
                  </Button>
                ) : null}
              </div>
              {openInvoices.length === 0 ? (
                <p className="text-sm text-zinc-500">{t("payments.noOutstandingInvoices")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200 dark:border-zinc-800">
                    <tr className="text-left">
                      <th className="py-2 text-xs uppercase text-zinc-500">
                        {t("payments.invoice")}
                      </th>
                      <th className="py-2 text-right text-xs uppercase text-zinc-500">
                        {t("payments.total")}
                      </th>
                      <th className="py-2 text-right text-xs uppercase text-zinc-500">
                        {t("payments.balance")}
                      </th>
                      <th className="py-2 text-right text-xs uppercase text-zinc-500">
                        {t("payments.allocate")}
                      </th>
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
                            {inv.invoiceNumber ?? t("payments.draft")}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {formatCurrency(Number(inv.totalAmount), locale)}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {formatCurrency(Number(inv.balanceDue), locale)}
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
                  .filter(
                    (inv) => !fields.some((f) => (f as { invoiceId: string }).invoiceId === inv.id),
                  )
                  .map((inv) => (
                    <Button
                      key={inv.id}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => append({ invoiceId: inv.id, allocatedAmount: 0 })}
                    >
                      + {inv.invoiceNumber ?? t("payments.draft")} (
                      {formatCurrency(Number(inv.balanceDue), locale)})
                    </Button>
                  ))}
              </div>
              <AllocationSummary control={control} t={t} locale={locale} />
              <FormError message={errors.allocations?.message} />
            </div>
          ) : null}

          <FormError message={submitError ?? undefined} />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending}>
            {t("payments.recordPayment")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function AllocationSummary({
  control,
  t,
  locale,
}: {
  control: Control<Values>;
  t: TranslateFn;
  locale: Locale;
}) {
  const allocations = useWatch({ control, name: "allocations" }) ?? [];
  const total = useWatch({ control, name: "totalAmount" }) ?? 0;
  const sum = allocations.reduce((acc, a) => acc + (Number(a.allocatedAmount) || 0), 0);
  const diff = (Number(total) || 0) - sum;
  const matched = Math.abs(diff) < 0.00005;
  const fmt = (n: number) => formatNumber(n, locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return (
    <div className="mt-3 flex items-center gap-3 text-sm">
      <span className="text-zinc-500">{t("payments.allocatedLabel")}</span>
      <span className="font-mono">{fmt(sum)}</span>
      <span className="text-zinc-400">/</span>
      <span className="font-mono">{fmt(Number(total))}</span>
      <Badge variant={matched ? "success" : "warning"}>
        {matched ? t("payments.matches") : t("payments.delta", { delta: fmt(diff) })}
      </Badge>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
