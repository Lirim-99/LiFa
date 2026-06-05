"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
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
import { useT } from "@/i18n/client";
import { useCreateCompany } from "@/lib/queries/companies";
import { LEGAL_FORMS, type LegalForm } from "@/lib/types";

const LEGAL_FORM_VALUES = LEGAL_FORMS.map((f) => f.value) as [LegalForm, ...LegalForm[]];

export function CreateCompanyForm() {
  const t = useT();
  const router = useRouter();
  const create = useCreateCompany();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const CreateCompanySchema = z.object({
    legalName: z.string().min(1, t("common.required")).max(255),
    legalForm: z.enum(LEGAL_FORM_VALUES),
    tradeName: z.string().max(255).optional().or(z.literal("")),
    uinNui: z.string().max(50).optional().or(z.literal("")),
    fiscalNumber: z.string().max(50).optional().or(z.literal("")),
    vatNumber: z.string().max(50).optional().or(z.literal("")),
    email: z.string().email(t("companies.invalidEmail")).optional().or(z.literal("")),
    phone: z.string().max(50).optional().or(z.literal("")),
    website: z.string().max(255).optional().or(z.literal("")),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
  });

  type FormValues = z.infer<typeof CreateCompanySchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateCompanySchema) as Resolver<FormValues>,
    defaultValues: { fiscalYearStartMonth: 1, legalForm: "SHPK" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    // Drop empty strings so the BE doesn't try to validate them.
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
    );
    try {
      await create.mutateAsync(payload as never);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("companies.failedToCreate"));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("companies.profileTitle")}</CardTitle>
        <CardDescription>{t("companies.profileDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="legalName">{t("companies.legalName")}</Label>
              <Input id="legalName" invalid={!!errors.legalName} {...register("legalName")} />
              <FormError message={errors.legalName?.message} />
            </div>
            <div>
              <Label htmlFor="tradeName">{t("companies.tradeName")}</Label>
              <Input id="tradeName" {...register("tradeName")} />
            </div>
            <div>
              <Label htmlFor="legalForm">{t("companies.legalForm")}</Label>
              <Select id="legalForm" invalid={!!errors.legalForm} {...register("legalForm")}>
                {LEGAL_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {t(f.label)}
                  </option>
                ))}
              </Select>
              <FormError message={errors.legalForm?.message} />
            </div>
            <div>
              <Label htmlFor="fiscalYearStartMonth">{t("companies.fiscalYearStarts")}</Label>
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
              <Label htmlFor="uinNui">{t("companies.uinNui")}</Label>
              <Input id="uinNui" {...register("uinNui")} />
            </div>
            <div>
              <Label htmlFor="fiscalNumber">{t("companies.fiscalNumber")}</Label>
              <Input id="fiscalNumber" {...register("fiscalNumber")} />
            </div>
            <div>
              <Label htmlFor="vatNumber">{t("companies.vatNumber")}</Label>
              <Input id="vatNumber" {...register("vatNumber")} />
            </div>
            <div>
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
              <FormError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="phone">{t("companies.phone")}</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div>
              <Label htmlFor="website">{t("companies.website")}</Label>
              <Input id="website" placeholder="https://" {...register("website")} />
            </div>
          </div>
          <FormError message={submitError ?? undefined} />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting || create.isPending}>
            {t("companies.createCompany")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
