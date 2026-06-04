"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { useCompany, useUpdateCompany } from "@/lib/queries/companies";
import { LEGAL_FORMS, type LegalForm } from "@/lib/types";

const LEGAL_FORM_VALUES = LEGAL_FORMS.map((f) => f.value) as [LegalForm, ...LegalForm[]];

const Schema = z.object({
  legalName: z.string().min(1, "Required").max(255),
  legalForm: z.enum(LEGAL_FORM_VALUES),
  tradeName: z.string().max(255).optional().or(z.literal("")),
  uinNui: z.string().max(50).optional().or(z.literal("")),
  fiscalNumber: z.string().max(50).optional().or(z.literal("")),
  vatNumber: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  website: z.string().max(255).optional().or(z.literal("")),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
});
type Values = z.infer<typeof Schema>;

export function CompanyProfileForm({ companyId }: { companyId: string }) {
  const { data: company, isLoading } = useCompany(companyId);
  const update = useUpdateCompany(companyId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(Schema) });

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
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Legal identity, tax IDs, and contact info.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="legalName">Legal name *</Label>
                <Input id="legalName" invalid={!!errors.legalName} {...register("legalName")} />
                <FormError message={errors.legalName?.message} />
              </div>
              <div>
                <Label htmlFor="tradeName">Trade name</Label>
                <Input id="tradeName" {...register("tradeName")} />
              </div>
              <div>
                <Label htmlFor="legalForm">Legal form *</Label>
                <Select id="legalForm" {...register("legalForm")}>
                  {LEGAL_FORMS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="fiscalYearStartMonth">Fiscal year starts</Label>
                <Select
                  id="fiscalYearStartMonth"
                  {...register("fiscalYearStartMonth", { valueAsNumber: true })}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2026, m - 1, 1).toLocaleString("en", { month: "long" })}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="uinNui">UIN / NUI (ARBK)</Label>
                <Input id="uinNui" {...register("uinNui")} />
              </div>
              <div>
                <Label htmlFor="fiscalNumber">Fiscal number (TAK)</Label>
                <Input id="fiscalNumber" {...register("fiscalNumber")} />
              </div>
              <div>
                <Label htmlFor="vatNumber">VAT number</Label>
                <Input id="vatNumber" {...register("vatNumber")} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
                <FormError message={errors.email?.message} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" placeholder="https://" {...register("website")} />
              </div>
            </div>
          )}
          <FormError message={submitError ?? undefined} />
        </CardContent>
        <CardFooter className="justify-between">
          <span className="text-sm text-zinc-500">
            {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : ""}
          </span>
          <Button type="submit" loading={isSubmitting || update.isPending} disabled={!isDirty}>
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
