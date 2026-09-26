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
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency } from "@/i18n/format";
import { downloadPdf } from "@/lib/download-pdf";
import { useAccounts } from "@/lib/queries/accounts";
import { FiscalCouponCnPanel } from "./fiscal-coupon-cn-panel";
import { useCatalog } from "@/lib/queries/catalog";
import { useContacts } from "@/lib/queries/contacts";
import {
  useCreditNote,
  useCreateCreditNote,
  useDeleteCreditNote,
  useIssueCreditNote,
  useUpdateCreditNote,
  useVoidCreditNote,
} from "@/lib/queries/credit-notes";
import { useTaxRates } from "@/lib/queries/tax";
import { DISCOUNT_TYPES, type CreditNoteType, type DiscountType } from "@/lib/types";

const LineSchema = z.object({
  productServiceId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional().or(z.literal("")),
  discountValue: z.coerce.number().min(0).optional(),
  taxRateId: z.string().uuid().optional().or(z.literal("")),
  accountId: z.string().uuid().optional().or(z.literal("")),
});

function makeSchema(t: ReturnType<typeof useT>) {
  return z.object({
    contactId: z.string().uuid(t("common.required")),
    issueDate: z.string().min(1),
    reason: z.string().max(1000).optional().or(z.literal("")),
    originalInvoiceId: z.string().uuid().optional().or(z.literal("")),
    originalBillId: z.string().uuid().optional().or(z.literal("")),
    lines: z.array(LineSchema).min(1),
  });
}
type Values = z.infer<ReturnType<typeof makeSchema>>;

export function CreditNoteEditor({
  id,
  type: newType,
  onDone,
  onCancel,
}: {
  id?: string;
  type?: CreditNoteType;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const Schema = useMemo(() => makeSchema(t), [t]);
  const { data: existing } = useCreditNote(id);
  const create = useCreateCreditNote();
  const update = useUpdateCreditNote(id ?? "");
  const issue = useIssueCreditNote();
  const voidCN = useVoidCreditNote();
  const del = useDeleteCreditNote();

  const cnType = existing?.type ?? newType ?? "SALES";
  const isSales = cnType === "SALES";

  const { data: contactsResp } = useContacts({
    limit: 200,
    ...(isSales ? { isCustomer: true } : { isVendor: true }),
    isActive: true,
  });
  const { data: taxRates } = useTaxRates();
  const { data: accounts } = useAccounts();
  const { data: catalogResp } = useCatalog({ limit: 200, isActive: true });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDraft = !existing || existing.status === "DRAFT";

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema) as never,
    defaultValues: {
      contactId: "",
      issueDate: new Date().toISOString().slice(0, 10),
      reason: "",
      originalInvoiceId: "",
      originalBillId: "",
      lines: [{ quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  useEffect(() => {
    if (existing) {
      reset({
        contactId: existing.contactId,
        issueDate: existing.issueDate.slice(0, 10),
        reason: existing.reason ?? "",
        originalInvoiceId: existing.originalInvoiceId ?? "",
        originalBillId: existing.originalBillId ?? "",
        lines:
          existing.lines?.map((l) => ({
            productServiceId: l.productServiceId ?? "",
            description: l.description ?? "",
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            discountType: (l.discountType as DiscountType) ?? "",
            discountValue: l.discountValue ? Number(l.discountValue) : undefined,
            taxRateId: l.taxRateId ?? "",
            accountId: l.accountId ?? "",
          })) ?? [{ quantity: 1, unitPrice: 0 }],
      });
    }
  }, [existing, reset]);

  async function onSubmit(values: Values, action: "save" | "issue") {
    setSubmitError(null);
    const payload = {
      type: cnType,
      contactId: values.contactId,
      issueDate: values.issueDate,
      reason: values.reason || undefined,
      originalInvoiceId: isSales && values.originalInvoiceId ? values.originalInvoiceId : undefined,
      originalBillId: !isSales && values.originalBillId ? values.originalBillId : undefined,
      lines: values.lines.map((l) => ({
        productServiceId: l.productServiceId || undefined,
        description: l.description || undefined,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountType: (l.discountType as DiscountType) || undefined,
        discountValue: l.discountValue || undefined,
        taxRateId: l.taxRateId || undefined,
        accountId: l.accountId || undefined,
      })),
    };

    try {
      let saved: { id: string };
      if (id) {
        saved = await update.mutateAsync(payload);
      } else {
        saved = await create.mutateAsync(payload);
      }
      if (action === "issue") {
        await issue.mutateAsync(saved.id);
      }
      onDone();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleVoid() {
    if (!id) return;
    if (!confirm(t("creditNotes.confirmVoid"))) return;
    try {
      await voidCN.mutateAsync(id);
      onDone();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm(t("creditNotes.confirmDelete"))) return;
    try {
      await del.mutateAsync(id);
      onDone();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {id ? t("creditNotes.edit") : t("creditNotes.new")}
          <Badge variant={isSales ? "info" : "default"}>
            {t(`enums.creditNoteType.${cnType}`)}
          </Badge>
          {existing && (
            <Badge variant={existing.status === "ISSUED" ? "success" : existing.status === "VOID" ? "danger" : "warning"}>
              {t(`enums.creditNoteStatus.${existing.status}`)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit((v) => onSubmit(v, "save"))}>
        <CardContent className="space-y-4">
          {submitError && <FormError message={submitError} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="contactId">
                {isSales ? t("creditNotes.customer") : t("creditNotes.vendor")}
              </Label>
              <Select id="contactId" {...register("contactId")} disabled={!isDraft}>
                <option value="">{t("common.select")}</option>
                {(contactsResp as { data?: { id: string; displayName: string }[] })?.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </Select>
              {errors.contactId && <FormError message={errors.contactId.message} />}
            </div>
            <div>
              <Label htmlFor="issueDate">{t("creditNotes.date")}</Label>
              <Input id="issueDate" type="date" {...register("issueDate")} disabled={!isDraft} />
            </div>
            <div>
              <Label htmlFor="reason">{t("creditNotes.reason")}</Label>
              <Textarea id="reason" rows={1} {...register("reason")} disabled={!isDraft} />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>{t("creditNotes.lines")}</Label>
              {isDraft && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => append({ quantity: 1, unitPrice: 0 })}
                >
                  + {t("common.addLine")}
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-1 py-1">{t("common.product")}</th>
                    <th className="px-1 py-1">{t("common.description")}</th>
                    <th className="px-1 py-1 text-right">{t("common.qty")}</th>
                    <th className="px-1 py-1 text-right">{t("common.unitPrice")}</th>
                    <th className="px-1 py-1">{t("common.tax")}</th>
                    <th className="px-1 py-1 text-right">{t("common.lineTotal")}</th>
                    {isDraft && <th />}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, idx) => (
                    <LineRow
                      key={field.id}
                      idx={idx}
                      control={control}
                      register={register}
                      remove={remove}
                      isDraft={isDraft}
                      catalog={catalogResp?.data}
                      taxRates={taxRates}
                      locale={locale}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <LineTotals control={control} taxRates={taxRates} locale={locale} />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-2 border-t px-6 py-3">
          <div className="flex gap-2">
            {isDraft && id && (
              <Button type="button" variant="danger" onClick={handleDelete} disabled={isSubmitting}>
                {t("common.delete")}
              </Button>
            )}
            {existing?.status === "ISSUED" && (
              <Button type="button" variant="danger" onClick={handleVoid} disabled={isSubmitting}>
                {t("common.void")}
              </Button>
            )}
            {existing && existing.status !== "DRAFT" && (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  setSubmitError(null);
                  try {
                    await downloadPdf(
                      `/credit-notes/${existing.id}/pdf`,
                      `${existing.creditNoteNumber ?? "credit-note"}.pdf`,
                    );
                  } catch (err) {
                    setSubmitError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                PDF ↓
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            {isDraft && (
              <>
                <Button type="submit" variant="secondary" disabled={isSubmitting}>
                  {t("common.saveDraft")}
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit((v) => onSubmit(v, "issue"))}
                >
                  {t("creditNotes.issue")}
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      </form>
    </Card>
    {existing && existing.status === "ISSUED" && (
      <div className="mt-4">
        <FiscalCouponCnPanel creditNoteId={existing.id} />
      </div>
    )}
    </>
  );
}

function LineRow({
  idx,
  control,
  register,
  remove,
  isDraft,
  catalog,
  taxRates,
  locale,
}: {
  idx: number;
  control: Control<Values>;
  register: ReturnType<typeof useForm<Values>>["register"];
  remove: (idx: number) => void;
  isDraft: boolean;
  catalog?: { id: string; name: string; salePrice?: string | null; purchasePrice?: string | null }[];
  taxRates?: { id: string; name: string; rate: string }[];
  locale: string;
}) {
  const line = useWatch({ control, name: `lines.${idx}` });
  const qty = Number(line?.quantity ?? 0);
  const price = Number(line?.unitPrice ?? 0);
  const lineTotal = qty * price;

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="px-1 py-1">
        <Select {...register(`lines.${idx}.productServiceId`)} disabled={!isDraft} className="w-28">
          <option value="">—</option>
          {catalog?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-1 py-1">
        <Input {...register(`lines.${idx}.description`)} disabled={!isDraft} className="w-32" />
      </td>
      <td className="px-1 py-1">
        <Input
          type="number"
          step="any"
          min={0}
          {...register(`lines.${idx}.quantity`)}
          disabled={!isDraft}
          className="w-16 text-right"
        />
      </td>
      <td className="px-1 py-1">
        <Input
          type="number"
          step="any"
          min={0}
          {...register(`lines.${idx}.unitPrice`)}
          disabled={!isDraft}
          className="w-20 text-right"
        />
      </td>
      <td className="px-1 py-1">
        <Select {...register(`lines.${idx}.taxRateId`)} disabled={!isDraft} className="w-24">
          <option value="">—</option>
          {taxRates?.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.name} ({tr.rate}%)
            </option>
          ))}
        </Select>
      </td>
      <td className="px-1 py-1 text-right font-mono">
        {formatCurrency(lineTotal, locale as "en" | "sq")}
      </td>
      {isDraft && (
        <td className="px-1 py-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => remove(idx)}
            className="text-red-500"
          >
            ×
          </Button>
        </td>
      )}
    </tr>
  );
}

function LineTotals({
  control,
  taxRates,
  locale,
}: {
  control: Control<Values>;
  taxRates?: { id: string; rate: string }[];
  locale: string;
}) {
  const lines = useWatch({ control, name: "lines" });
  const taxMap = new Map(taxRates?.map((r) => [r.id, Number(r.rate)]) ?? []);

  let subtotal = 0;
  let tax = 0;
  for (const l of lines ?? []) {
    const net = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
    subtotal += net;
    if (l.taxRateId && taxMap.has(l.taxRateId)) {
      tax += net * (taxMap.get(l.taxRateId)! / 100);
    }
  }
  const total = subtotal + tax;

  return (
    <div className="mt-3 flex justify-end">
      <div className="w-56 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Subtotal</span>
          <span className="font-mono">{formatCurrency(subtotal, locale as "en" | "sq")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Tax</span>
          <span className="font-mono">{formatCurrency(tax, locale as "en" | "sq")}</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>Total</span>
          <span className="font-mono">{formatCurrency(total, locale as "en" | "sq")}</span>
        </div>
      </div>
    </div>
  );
}
