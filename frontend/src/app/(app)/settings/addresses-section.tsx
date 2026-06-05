"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/client";
import {
  useCompanyAddresses,
  useCreateAddress,
  useDeleteAddress,
  useUpdateAddress,
} from "@/lib/queries/companies";
import { ADDRESS_TYPES, type AddressType, type CompanyAddress } from "@/lib/types";

const ADDRESS_TYPE_VALUES = ADDRESS_TYPES.map((t) => t.value) as [AddressType, ...AddressType[]];

const AddressSchema = z.object({
  addressType: z.enum(ADDRESS_TYPE_VALUES),
  country: z.string().max(100).optional().or(z.literal("")),
  municipality: z.string().max(100).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  street: z.string().max(255).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
});
type Values = z.infer<typeof AddressSchema>;

export function AddressesSection({ companyId }: { companyId: string }) {
  const t = useT();
  const { data, isLoading } = useCompanyAddresses(companyId);
  const [editing, setEditing] = useState<CompanyAddress | null>(null);
  const [showNew, setShowNew] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{t("settings.addresses.title")}</CardTitle>
            <CardDescription>{t("settings.addresses.description")}</CardDescription>
          </div>
          {!showNew && !editing ? (
            <Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>
              {t("settings.addresses.addAddress")}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showNew ? (
          <AddressForm
            companyId={companyId}
            onDone={() => setShowNew(false)}
            onCancel={() => setShowNew(false)}
          />
        ) : null}

        {isLoading ? <p className="text-sm text-zinc-500">{t("common.loading")}</p> : null}

        {(data ?? []).map((a) =>
          editing?.id === a.id ? (
            <AddressForm
              key={a.id}
              companyId={companyId}
              initial={a}
              onDone={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <AddressRow key={a.id} address={a} companyId={companyId} onEdit={() => setEditing(a)} />
          ),
        )}

        {data && data.length === 0 && !showNew ? (
          <p className="text-sm text-zinc-500">{t("settings.addresses.empty")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AddressRow({
  address,
  companyId,
  onEdit,
}: {
  address: CompanyAddress;
  companyId: string;
  onEdit: () => void;
}) {
  const t = useT();
  const del = useDeleteAddress(companyId);
  const formatted =
    [address.street, address.city, address.municipality, address.country]
      .filter(Boolean)
      .join(", ") || t("settings.addresses.noDetails");

  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <Badge variant={address.isPrimary ? "success" : "outline"}>
          {t(`enums.addressType.${address.addressType}`)}
          {address.isPrimary ? ` ${t("settings.addresses.primarySuffix")}` : ""}
        </Badge>
        <span className="text-sm">{formatted}</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          {t("settings.addresses.edit")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm(t("settings.addresses.confirmDelete"))) void del.mutate(address.id);
          }}
        >
          {t("settings.addresses.delete")}
        </Button>
      </div>
    </div>
  );
}

function AddressForm({
  companyId,
  initial,
  onDone,
  onCancel,
}: {
  companyId: string;
  initial?: CompanyAddress;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const create = useCreateAddress(companyId);
  const update = useUpdateAddress(companyId);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(AddressSchema) as Resolver<Values>,
    defaultValues: {
      addressType: (initial?.addressType ?? "REGISTERED") as AddressType,
      country: initial?.country ?? "",
      municipality: initial?.municipality ?? "",
      city: initial?.city ?? "",
      street: initial?.street ?? "",
      postalCode: initial?.postalCode ?? "",
      isPrimary: initial?.isPrimary ?? false,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
    );
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...payload } as never);
      } else {
        await create.mutateAsync(payload as never);
      }
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("settings.failedToSave"));
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="addressType">{t("common.type")}</Label>
          <Select id="addressType" {...register("addressType")}>
            {ADDRESS_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <input id="isPrimary" type="checkbox" className="h-4 w-4" {...register("isPrimary")} />
          <Label htmlFor="isPrimary">{t("settings.addresses.primary")}</Label>
        </div>
        <div>
          <Label htmlFor="country">{t("settings.addresses.country")}</Label>
          <Input id="country" {...register("country")} />
        </div>
        <div>
          <Label htmlFor="municipality">{t("settings.addresses.municipality")}</Label>
          <Input id="municipality" {...register("municipality")} />
        </div>
        <div>
          <Label htmlFor="city">{t("settings.addresses.city")}</Label>
          <Input id="city" {...register("city")} />
        </div>
        <div>
          <Label htmlFor="postalCode">{t("settings.addresses.postalCode")}</Label>
          <Input id="postalCode" {...register("postalCode")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="street">{t("settings.addresses.street")}</Label>
          <Input id="street" {...register("street")} />
        </div>
      </div>
      <FormError message={submitError ?? errors.addressType?.message} />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting || create.isPending || update.isPending}>
          {initial ? t("common.save") : t("settings.addresses.add")}
        </Button>
      </div>
    </form>
  );
}
