"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { useT } from "@/i18n/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  useCreateTaxRate,
  useDeactivateTaxRate,
  useTaxRates,
  useUpdateTaxRate,
} from "@/lib/queries/tax";
import {
  TAX_CALCULATION_TYPES,
  TAX_SCOPES,
  type TaxCalculationType,
  type TaxRate,
  type TaxScope,
} from "@/lib/types";

const CALC_VALUES = TAX_CALCULATION_TYPES.map((t) => t.value) as [
  TaxCalculationType,
  ...TaxCalculationType[],
];
const SCOPE_VALUES = TAX_SCOPES.map((t) => t.value) as [TaxScope, ...TaxScope[]];

const Schema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  rate: z.coerce.number().min(0).max(100),
  calculationType: z.enum(CALC_VALUES),
  scope: z.enum(SCOPE_VALUES),
  isDefault: z.boolean().default(false),
});
type Values = z.infer<typeof Schema>;

export function TaxRatesClient() {
  const t = useT();
  const { data, isLoading } = useTaxRates();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(null);
            setShowNew((v) => !v);
          }}
        >
          {showNew ? t("common.cancel") : t("tax.newRateButton")}
        </Button>
      </div>

      {showNew ? (
        <RateForm onDone={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
      ) : null}

      {isLoading ? <p className="text-sm text-zinc-500">{t("common.loading")}</p> : null}

      {(data ?? []).map((rate) =>
        editing?.id === rate.id ? (
          <RateForm
            key={rate.id}
            initial={rate}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Card key={rate.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Badge variant={rate.isDefault ? "success" : "outline"}>{rate.code}</Badge>
                <div>
                  <div className="font-medium">{rate.name}</div>
                  <div className="text-xs text-zinc-500">
                    {rate.rate}% · {t(`enums.taxCalculationType.${rate.calculationType}`)} ·{" "}
                    {t(`enums.taxScope.${rate.scope}`)}
                  </div>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(rate)}>
                {t("tax.edit")}
              </Button>
            </CardContent>
          </Card>
        ),
      )}

      {data && data.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("tax.empty")}</p>
      ) : null}
    </div>
  );
}

function RateForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: TaxRate;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const create = useCreateTaxRate();
  const update = useUpdateTaxRate(initial?.id ?? "");
  const deactivate = useDeactivateTaxRate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema) as Resolver<Values>,
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      rate: initial?.rate ? Number(initial.rate) : 0,
      calculationType: (initial?.calculationType ?? "EXCLUSIVE") as TaxCalculationType,
      scope: (initial?.scope ?? "SALES") as TaxScope,
      isDefault: initial?.isDefault ?? false,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (initial) await update.mutateAsync(values);
      else await create.mutateAsync(values);
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("tax.saveFailed"));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial ? t("tax.editRate") : t("tax.newRate")}</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">{t("tax.nameLabel")}</Label>
              <Input id="name" invalid={!!errors.name} {...register("name")} />
              <FormError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="code">{t("tax.codeLabel")}</Label>
              <Input id="code" invalid={!!errors.code} {...register("code")} />
              <FormError message={errors.code?.message} />
            </div>
            <div>
              <Label htmlFor="rate">{t("tax.rateLabel")}</Label>
              <Input
                id="rate"
                type="number"
                step="0.0001"
                min={0}
                max={100}
                {...register("rate", { valueAsNumber: true })}
              />
            </div>
            <div className="flex items-end gap-2">
              <input
                id="isDefault"
                type="checkbox"
                className="h-4 w-4"
                {...register("isDefault")}
              />
              <Label htmlFor="isDefault">{t("tax.default")}</Label>
            </div>
            <div>
              <Label htmlFor="calculationType">{t("tax.calculation")}</Label>
              <Select id="calculationType" {...register("calculationType")}>
                {TAX_CALCULATION_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="scope">{t("tax.scope")}</Label>
              <Select id="scope" {...register("scope")}>
                {TAX_SCOPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <FormError message={submitError ?? undefined} />

          {initial ? (
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
              <span className="text-zinc-600 dark:text-zinc-400">{t("tax.deactivateHint")}</span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (!confirm(t("tax.deactivateConfirm"))) return;
                  await deactivate.mutateAsync(initial.id);
                  onDone();
                }}
              >
                {t("tax.deactivate")}
              </Button>
            </div>
          ) : null}
        </CardContent>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending || update.isPending}>
            {initial ? t("common.save") : t("tax.create")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
