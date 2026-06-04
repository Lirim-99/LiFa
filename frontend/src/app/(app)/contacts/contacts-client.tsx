"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useContacts, useCreateContact, useUpdateContact } from "@/lib/queries/contacts";
import type { Contact } from "@/lib/types";

const ContactSchema = z
  .object({
    displayName: z.string().min(1, "Required").max(255),
    legalName: z.string().max(255).optional().or(z.literal("")),
    isCustomer: z.boolean().default(false),
    isVendor: z.boolean().default(false),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().max(50).optional().or(z.literal("")),
    taxId: z.string().max(50).optional().or(z.literal("")),
    paymentTermsDays: z.coerce.number().int().min(0).optional(),
    currency: z.string().max(3).default("EUR"),
    country: z.string().max(100).optional().or(z.literal("")),
    municipality: z.string().max(100).optional().or(z.literal("")),
    city: z.string().max(100).optional().or(z.literal("")),
    street: z.string().max(255).optional().or(z.literal("")),
    postalCode: z.string().max(20).optional().or(z.literal("")),
    notes: z.string().max(1000).optional().or(z.literal("")),
  })
  .refine((v) => v.isCustomer || v.isVendor, {
    message: "Must be customer, vendor, or both",
    path: ["isCustomer"],
  });
type Values = z.infer<typeof ContactSchema>;

type RoleFilter = "all" | "customers" | "vendors";

export function ContactsClient() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const params = {
    page,
    limit: 25,
    search: search || undefined,
    isCustomer: roleFilter === "customers" ? true : undefined,
    isVendor: roleFilter === "vendors" ? true : undefined,
    isActive: includeInactive ? undefined : true,
  };
  const { data, isLoading } = useContacts(params);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Name, email, legal name…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div>
              <Label htmlFor="roleFilter">Role</Label>
              <Select
                id="roleFilter"
                value={roleFilter}
                onChange={(e) => {
                  setPage(1);
                  setRoleFilter(e.target.value as RoleFilter);
                }}
              >
                <option value="all">All</option>
                <option value="customers">Customers</option>
                <option value="vendors">Vendors</option>
              </Select>
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Include inactive
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setShowNew((v) => !v);
              }}
            >
              {showNew ? "Cancel" : "+ New contact"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <ContactForm onDone={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : !data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No contacts.
                  </td>
                </tr>
              ) : (
                data.data.map((c) =>
                  editing?.id === c.id ? (
                    <tr key={c.id}>
                      <td colSpan={5} className="p-4">
                        <ContactForm
                          initial={c}
                          onDone={() => setEditing(null)}
                          onCancel={() => setEditing(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <Td>
                        <div className="font-medium">{c.displayName}</div>
                        {c.legalName && c.legalName !== c.displayName ? (
                          <div className="text-xs text-zinc-500">{c.legalName}</div>
                        ) : null}
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          {c.isCustomer ? <Badge variant="success">Customer</Badge> : null}
                          {c.isVendor ? <Badge>Vendor</Badge> : null}
                          {!c.isActive ? <Badge variant="warning">Inactive</Badge> : null}
                        </div>
                      </Td>
                      <Td>{c.email ?? "—"}</Td>
                      <Td>{c.phone ?? "—"}</Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                          Edit
                        </Button>
                      </Td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data && data.totalPages > 1 ? (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          onChange={setPage}
        />
      ) : null}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function ContactForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Contact;
  onDone: () => void;
  onCancel: () => void;
}) {
  const create = useCreateContact();
  const update = useUpdateContact(initial?.id ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(ContactSchema),
    defaultValues: {
      displayName: initial?.displayName ?? "",
      legalName: initial?.legalName ?? "",
      isCustomer: initial?.isCustomer ?? true,
      isVendor: initial?.isVendor ?? false,
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      taxId: initial?.taxId ?? "",
      paymentTermsDays: initial?.paymentTermsDays ?? undefined,
      currency: initial?.currency ?? "EUR",
      country: initial?.country ?? "",
      municipality: initial?.municipality ?? "",
      city: initial?.city ?? "",
      street: initial?.street ?? "",
      postalCode: initial?.postalCode ?? "",
      notes: initial?.notes ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
    );
    try {
      if (initial) await update.mutateAsync(payload as never);
      else await create.mutateAsync(payload as never);
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial ? "Edit contact" : "New contact"}</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="displayName">Display name *</Label>
              <Input id="displayName" invalid={!!errors.displayName} {...register("displayName")} />
              <FormError message={errors.displayName?.message} />
            </div>
            <div>
              <Label htmlFor="legalName">Legal name</Label>
              <Input id="legalName" {...register("legalName")} />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...register("isCustomer")} />
                Customer
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...register("isVendor")} />
                Vendor
              </label>
            </div>
            <div>
              <Label htmlFor="taxId">Tax ID</Label>
              <Input id="taxId" {...register("taxId")} />
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
              <Label htmlFor="paymentTermsDays">Payment terms (days)</Label>
              <Input
                id="paymentTermsDays"
                type="number"
                min={0}
                {...register("paymentTermsDays", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" maxLength={3} {...register("currency")} />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...register("country")} />
            </div>
            <div>
              <Label htmlFor="municipality">Municipality</Label>
              <Input id="municipality" {...register("municipality")} />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
            </div>
            <div>
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register("postalCode")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="street">Street</Label>
              <Input id="street" {...register("street")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} {...register("notes")} />
            </div>
          </div>
          <FormError message={submitError ?? errors.isCustomer?.message} />

          {initial && initial.isActive ? (
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
              <span className="text-zinc-600 dark:text-zinc-400">
                Deactivate — hides this contact from lists. Reactivate later from filter.
              </span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (!confirm("Deactivate this contact?")) return;
                  await update.mutateAsync({ isActive: false });
                  onDone();
                }}
              >
                Deactivate
              </Button>
            </div>
          ) : null}
          {initial && !initial.isActive ? (
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
              <span className="text-zinc-600 dark:text-zinc-400">Currently inactive.</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await update.mutateAsync({ isActive: true });
                  onDone();
                }}
              >
                Reactivate
              </Button>
            </div>
          ) : null}
        </CardContent>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || create.isPending || update.isPending}>
            {initial ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
