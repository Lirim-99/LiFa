"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useCreateCompany } from "@/lib/queries/companies";
import { LEGAL_FORMS, type LegalForm } from "@/lib/types";

const LEGAL_FORM_VALUES = LEGAL_FORMS.map((f) => f.value) as [LegalForm, ...LegalForm[]];

const CreateCompanySchema = z.object({
  legalName: z.string().min(1, "Required").max(255),
  legalForm: z.enum(LEGAL_FORM_VALUES),
  tradeName: z.string().max(255).optional().or(z.literal("")),
  uinNui: z.string().max(50).optional().or(z.literal("")),
  fiscalNumber: z.string().max(50).optional().or(z.literal("")),
  vatNumber: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  website: z.string().max(255).optional().or(z.literal("")),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(1),
});

type FormValues = z.infer<typeof CreateCompanySchema>;

export function CreateCompanyForm() {
  const router = useRouter();
  const create = useCreateCompany();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateCompanySchema),
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
      setSubmitError(err instanceof Error ? err.message : "Failed to create company");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company profile</CardTitle>
        <CardDescription>
          Only the legal name and legal form are required. Tax IDs and contact info can be filled in
          later from Settings.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
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
              <Select id="legalForm" invalid={!!errors.legalForm} {...register("legalForm")}>
                {LEGAL_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <FormError message={errors.legalForm?.message} />
            </div>
            <div>
              <Label htmlFor="fiscalYearStartMonth">Fiscal year starts (month)</Label>
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
          <FormError message={submitError ?? undefined} />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting || create.isPending}>
            Create company
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
