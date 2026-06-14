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
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency } from "@/i18n/format";
import { useAccounts } from "@/lib/queries/accounts";
import {
  useBill,
  useCreateBill,
  useDeleteBill,
  usePostBill,
  useUpdateBill,
  useVoidBill,
} from "@/lib/queries/bills";
import { useCatalog } from "@/lib/queries/catalog";
import { useContacts } from "@/lib/queries/contacts";
import { useCreateBillPayment } from "@/lib/queries/payments";
import { useTaxRates } from "@/lib/queries/tax";
import { DISCOUNT_TYPES, PAYMENT_METHODS, type DiscountType, type PaymentMethod } from "@/lib/types";

const LineSchema = z.object({
  productServiceId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional().or(z.literal("")),
  discountValue: z.coerce.number().min(0).optional(),
  taxRateId: z.string().uuid().optional().or(z.literal("")),
  expenseAccountId: z.string().uuid().optional().or(z.literal("")),
});

function makeSchema(t: ReturnType<typeof useT>) {
  return z.object({
    contactId: z.string().uuid(t("bills.vendorRequired")),
    billNumber: z.string().min(1, t("common.required")).max(100),
    billDate: z.string().min(1),
    dueDate: z.string().min(1),
    notes: z.string().max(1000).optional().or(z.literal("")),
    lines: z.array(LineSchema).min(1),
  });
}
type Values = z.infer<ReturnType<typeof makeSchema>>;

export function BillEditor({
  id,
  onDone,
  onCancel,
}: {
  id?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const Schema = useMemo(() => makeSchema(t), [t]);
  const { data: existing } = useBill(id);
  const create = useCreateBill();
  const update = useUpdateBill(id ?? "");
  const post = usePostBill();
  const voidBill = useVoidBill();
  const del = useDeleteBill();
  const { data: contactsResp } = useContacts({ limit: 200, isVendor: true, isActive: true });
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
    resolver: zodResolver(Schema) as Resolver<Values>,
    defaultValues: {
      contactId: "",
      billNumber: "",
      billDate: today(),
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
      billNumber: existing.billNumber ?? "",
      billDate: existing.billDate.slice(0, 10),
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
              expenseAccountId: l.expenseAccountId ?? "",
            }))
          : [emptyLine()],
    });
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = {
      contactId: values.contactId,
      billNumber: values.billNumber,
      billDate: values.billDate,
      dueDate: values.dueDate,
      notes: values.notes || undefined,
      lines: values.lines.map((l: Values["lines"][number]) => ({
        productServiceId: l.productServiceId || undefined,
        description: l.description || undefined,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountType: l.discountType || undefined,
        discountValue: l.discountType ? l.discountValue : undefined,
        taxRateId: l.taxRateId || undefined,
        expenseAccountId: l.expenseAccountId || undefined,
      })),
    };
    try {
      if (existing) await update.mutateAsync(payload as never);
      else await create.mutateAsync(payload as never);
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("bills.failedToSave"));
    }
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {existing
                ? existing.billNumber
                  ? t("bills.billTitle", { number: existing.billNumber })
                  : t("bills.draftBill")
                : t("bills.newBillTitle")}
            </CardTitle>
            {existing ? <Badge>{t(`enums.billStatus.${existing.status}`)}</Badge> : null}
          </div>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="contactId">{t("bills.vendorRequired")}</Label>
                <Select
                  id="contactId"
                  disabled={!isDraft}
                  invalid={!!errors.contactId}
                  {...register("contactId")}
                >
                  <option value="">{t("bills.pickVendorOption")}</option>
                  {(contactsResp?.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </Select>
                <FormError message={errors.contactId?.message} />
              </div>
              <div>
                <Label htmlFor="billNumber">{t("bills.billNumberRequired")}</Label>
                <Input
                  id="billNumber"
                  disabled={!isDraft}
                  invalid={!!errors.billNumber}
                  {...register("billNumber")}
                />
                <FormError message={errors.billNumber?.message} />
              </div>
              <div>
                <Label htmlFor="billDate">{t("bills.billDateRequired")}</Label>
                <Input id="billDate" type="date" disabled={!isDraft} {...register("billDate")} />
              </div>
              <div>
                <Label htmlFor="dueDate">{t("bills.dueDateRequired")}</Label>
                <Input id="dueDate" type="date" disabled={!isDraft} {...register("dueDate")} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800">
                  <tr className="text-left">
                    <th className="py-2 text-xs uppercase text-zinc-500">{t("bills.product")}</th>
                    <th className="py-2 text-xs uppercase text-zinc-500">
                      {t("bills.lineDescription")}
                    </th>
                    <th className="py-2 text-right text-xs uppercase text-zinc-500">
                      {t("bills.qty")}
                    </th>
                    <th className="py-2 text-right text-xs uppercase text-zinc-500">
                      {t("bills.unitPrice")}
                    </th>
                    <th className="py-2 text-xs uppercase text-zinc-500">{t("bills.discount")}</th>
                    <th className="py-2 text-xs uppercase text-zinc-500">{t("bills.tax")}</th>
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
                          {(taxRates ?? []).map((tr) => (
                            <option key={tr.id} value={tr.id}>
                              {tr.code} ({tr.rate}%)
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2">
                        {isDraft && fields.length > 1 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(idx)}
                          >
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
                  {t("bills.addLine")}
                </Button>
                <details className="text-xs text-zinc-500">
                  <summary className="cursor-pointer">{t("bills.overrideExpenseAccount")}</summary>
                  <div className="mt-2 space-y-2">
                    {fields.map((field, idx) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <span className="w-6 text-right">{idx + 1}.</span>
                        <Select className="flex-1" {...register(`lines.${idx}.expenseAccountId`)}>
                          <option value="">{t("bills.useDefaultExpense")}</option>
                          {(accounts ?? [])
                            .filter((a) => a.accountType === "EXPENSE" || a.accountType === "ASSET")
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
              <Label htmlFor="notes">{t("bills.notes")}</Label>
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
                    if (!confirm(t("bills.confirmDeleteDraft"))) return;
                    await del.mutateAsync(existing.id);
                    onDone();
                  }}
                >
                  {t("bills.deleteDraft")}
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
              {isDraft ? (
                <>
                  <Button
                    type="submit"
                    loading={isSubmitting || create.isPending || update.isPending}
                  >
                    {existing ? t("common.save") : t("bills.createDraft")}
                  </Button>
                  {existing ? (
                    <Button
                      type="button"
                      onClick={async () => {
                        if (!confirm(t("bills.confirmPost"))) return;
                        setSubmitError(null);
                        try {
                          await post.mutateAsync(existing.id);
                          onDone();
                        } catch (err) {
                          setSubmitError(err instanceof Error ? err.message : t("bills.failed"));
                        }
                      }}
                      loading={post.isPending}
                    >
                      {t("bills.post")}
                    </Button>
                  ) : null}
                </>
              ) : null}
              {existing &&
              (existing.status === "OPEN" ||
                existing.status === "PARTIALLY_PAID" ||
                existing.status === "PAID") &&
              existing.balanceDue === existing.totalAmount ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={async () => {
                    if (!confirm(t("bills.confirmVoid"))) return;
                    setSubmitError(null);
                    try {
                      await voidBill.mutateAsync(existing.id);
                      onDone();
                    } catch (err) {
                      setSubmitError(err instanceof Error ? err.message : t("bills.failed"));
                    }
                  }}
                  loading={voidBill.isPending}
                >
                  {t("bills.void")}
                </Button>
              ) : null}
            </div>
          </CardFooter>
        </form>
      </Card>
      {existing && (existing.status === "OPEN" || existing.status === "PARTIALLY_PAID") ? (
        <div className="mt-4">
          <PaymentPanel
            contactId={existing.contactId}
            billId={existing.id}
            balanceDue={Number(existing.balanceDue)}
            onDone={onDone}
          />
        </div>
      ) : null}
    </>
  );
}

function PaymentPanel({
  contactId,
  billId,
  balanceDue,
  onDone,
}: {
  contactId: string;
  billId: string;
  balanceDue: number;
  onDone: () => void;
}) {
  const t = useT();
  const pay = useCreateBillPayment();
  const [amount, setAmount] = useState<number>(balanceDue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [paymentDate, setPaymentDate] = useState<string>(today());
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const onPay = async () => {
    setError(null);
    try {
      await pay.mutateAsync({
        contactId,
        paymentMethod,
        paymentDate,
        totalAmount: amount,
        referenceNumber: referenceNumber || undefined,
        allocations: [{ billId, allocatedAmount: amount }],
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("bills.payFailed"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("bills.recordPayment")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pay-amount">{t("bills.paymentAmount")}</Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.0001"
              min={0.0001}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="pay-method">{t("bills.paymentMethod")}</Label>
            <Select
              id="pay-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.label)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pay-date">{t("bills.paymentDate")}</Label>
            <Input
              id="pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pay-reference">{t("bills.reference")}</Label>
            <Input
              id="pay-reference"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </div>
        </div>
        <FormError message={error ?? undefined} />
      </CardContent>
      <CardFooter className="justify-end">
        <Button type="button" onClick={onPay} loading={pay.isPending}>
          {t("bills.pay")}
        </Button>
      </CardFooter>
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
  const tr = useT();
  const locale = useLocale();
  const lines = useWatch({ control, name: "lines" }) ?? [];
  const totals = useMemo(() => {
    let net = 0,
      tax = 0;
    for (const l of lines) {
      let n = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      if (l.discountType === "PERCENTAGE") n = n * (1 - (Number(l.discountValue) || 0) / 100);
      else if (l.discountType === "FIXED") n = Math.max(0, n - (Number(l.discountValue) || 0));
      const rate = taxRates.find((rr) => rr.id === l.taxRateId);
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
          {tr("bills.subtotal")}
        </td>
        <td colSpan={2} className="pt-2 text-right font-mono">
          {formatCurrency(totals.net, locale)}
        </td>
      </tr>
      <tr>
        <td colSpan={5} className="text-right text-xs uppercase text-zinc-500">
          {tr("bills.tax")}
        </td>
        <td colSpan={2} className="text-right font-mono">
          {formatCurrency(totals.tax, locale)}
        </td>
      </tr>
      <tr className="font-semibold">
        <td colSpan={5} className="pb-2 text-right text-xs uppercase">
          {tr("bills.total")}
        </td>
        <td colSpan={2} className="pb-2 text-right font-mono">
          {formatCurrency(totals.total, locale)}
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
    expenseAccountId: "",
  };
}
