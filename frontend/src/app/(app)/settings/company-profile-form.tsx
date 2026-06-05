"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { useCompany, useUpdateCompany } from "@/lib/queries/companies";
import { LEGAL_FORMS, type LegalForm } from "@/lib/types";

const LEGAL_FORM_VALUES = LEGAL_FORMS.map((f) => f.value) as [LegalForm, ...LegalForm[]];

export function CompanyProfileForm({ companyId }: { companyId: string }) {
  const t = useT();
  const locale = useLocale();
  const Schema = z.object({
    legalName: z.string().min(1, t("common.required")).max(255),
    legalForm: z.enum(LEGAL_FORM_VALUES),
    tradeName: z.string().max(255).optional().or(z.literal("")),
    uinNui: z.string().max(50).optional().or(z.literal("")),
    fiscalNumber: z.string().max(50).optional().or(z.literal("")),
    vatNumber: z.string().max(50).optional().or(z.literal("")),
    email: z.string().email(t("settings.invalidEmail")).optional().or(z.literal("")),
    phone: z.string().max(50).optional().or(z.literal("")),
    website: z.string().max(255).optional().or(z.literal("")),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  });
  type Values = z.infer<typeof Schema>;

  const { data: company, isLoading } = useCompany(companyId);
  const update = useUpdateCompany(companyId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(Schema) as Resolver<Values> });

  useEffect(() => {
    if (!company) return;
    reset({
      legalName: company.legalName,
      legalForm: company.legalForm,
      tradeName: company.tradeName ?? "",
      uinNui: company.uinNui ?? "",
      fiscalNumber: company.fiscalNumber ?? "",
      vatNumber: company.vatNumber ?? "",
      email: company.email ?? "",
      phone: company.phone ?? "",
      website: company.website ?? "",
      fiscalYearStartMonth: company.fiscalYearStartMonth,
    });
  }, [company, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
    );
    try {
      await update.mutateAsync(payload as never);
      // eslint-disable-next-line react-hooks/purity -- runs in event handler, not render
      setSavedAt(Date.now());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("settings.failedToSave"));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.profile.title")}</CardTitle>
        <CardDescription>{t("settings.profile.description")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-zinc-500">{t("common.loading")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="legalName">{t("settings.profile.legalName")}</Label>
                <Input id="legalName" invalid={!!errors.legalName} {...register("legalName")} />
                <FormError message={errors.legalName?.message} />
              </div>
              <div>
                <Label htmlFor="tradeName">{t("settings.profile.tradeName")}</Label>
                <Input id="tradeName" {...register("tradeName")} />
              </div>
              <div>
                <Label htmlFor="legalForm">{t("settings.profile.legalForm")}</Label>
                <Select id="legalForm" {...register("legalForm")}>
                  {LEGAL_FORMS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {t(f.label)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="fiscalYearStartMonth">{t("settings.profile.fiscalYearStarts")}</Label>
                <Select
                  id="fiscalYearStartMonth"
                  {...register("fiscalYearStartMonth", { valueAsNumber: true })}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {t(`common.monthLong.${m}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="uinNui">{t("settings.profile.uinNui")}</Label>
                <Input id="uinNui" {...register("uinNui")} />
              </div>
              <div>
                <Label htmlFor="fiscalNumber">{t("settings.profile.fiscalNumber")}</Label>
                <Input id="fiscalNumber" {...register("fiscalNumber")} />
              </div>
              <div>
                <Label htmlFor="vatNumber">{t("settings.profile.vatNumber")}</Label>
                <Input id="vatNumber" {...register("vatNumber")} />
              </div>
              <div>
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
                <FormError message={errors.email?.message} />
              </div>
              <div>
                <Label htmlFor="phone">{t("settings.profile.phone")}</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div>
                <Label htmlFor="website">{t("settings.profile.website")}</Label>
                <Input id="website" placeholder="https://" {...register("website")} />
              </div>
            </div>
          )}
          <FormError message={submitError ?? undefined} />
        </CardContent>
        <CardFooter className="justify-between">
          <span className="text-sm text-zinc-500">
            {savedAt
              ? t("settings.profile.savedAt", {
                  time: formatDate(savedAt, locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }),
                })
              : ""}
          </span>
          <Button type="submit" loading={isSubmitting || update.isPending} disabled={!isDirty}>
            {t("settings.profile.saveChanges")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
