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
import { useAccounts } from "@/lib/queries/accounts";
import {
  useCatalog,
  useCreateProductService,
  useDeactivateProductService,
  useUpdateProductService,
} from "@/lib/queries/catalog";
import { useTaxRates } from "@/lib/queries/tax";
import { PRODUCT_SERVICE_TYPES, type ProductService, type ProductServiceType } from "@/lib/types";

const TYPE_VALUES = PRODUCT_SERVICE_TYPES.map((t) => t.value) as [
  ProductServiceType,
  ...ProductServiceType[],
];

const Schema = z.object({
  name: z.string().min(1, "Required").max(255),
  type: z.enum(TYPE_VALUES),
  sku: z.string().max(50).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  unit: z.string().max(20).optional().or(z.literal("")),
  salePrice: z.coerce.number().min(0).optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  incomeAccountId: z.string().uuid().optional().or(z.literal("")),
  expenseAccountId: z.string().uuid().optional().or(z.literal("")),
  defaultTaxRateId: z.string().uuid().optional().or(z.literal("")),
});
type Values = z.infer<typeof Schema>;

export function CatalogClient() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "PRODUCT" | "SERVICE">("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ProductService | null>(null);

  const params = {
    page,
    limit: 25,
    search: search || undefined,
    type: typeFilter === "all" ? undefined : (typeFilter as "PRODUCT" | "SERVICE"),
    isActive: includeInactive ? undefined : true,
  };
  const { data, isLoading } = useCatalog(params);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Name, SKU, description…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                id="type"
                value={typeFilter}
                onChange={(e) => {
                  setPage(1);
                  setTypeFilter(e.target.value as never);
                }}
              >
                <option value="all">All</option>
                <option value="PRODUCT">Products</option>
                <option value="SERVICE">Services</option>
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
              {showNew ? "Cancel" : "+ New item"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <ItemForm onDone={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>SKU</Th>
                <Th className="text-right">Sale price</Th>
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
                    No catalog items.
                  </td>
                </tr>
              ) : (
                data.data.map((p) =>
                  editing?.id === p.id ? (
                    <tr key={p.id}>
                      <td colSpan={5} className="p-4">
                        <ItemForm
                          initial={p}
                          onDone={() => setEditing(null)}
                          onCancel={() => setEditing(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <Td>
                        <div className="font-medium">{p.name}</div>
                        {!p.isActive ? <Badge variant="warning">Inactive</Badge> : null}
                      </Td>
                      <Td>
                        <Badge variant={p.type === "PRODUCT" ? "default" : "outline"}>
                          {p.type}
                        </Badge>
                      </Td>
                      <Td className="font-mono text-xs">{p.sku ?? "—"}</Td>
                      <Td className="text-right">{p.salePrice ? `${p.salePrice}` : "—"}</Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
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
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} total
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
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

function ItemForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: ProductService;
  onDone: () => void;
  onCancel: () => void;
}) {
  const create = useCreateProductService();
  const update = useUpdateProductService(initial?.id ?? "");
  const deactivate = useDeactivateProductService();
  const { data: accounts } = useAccounts();
  const { data: taxRates } = useTaxRates();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: initial?.name ?? "",
      type: (initial?.type ?? "PRODUCT") as ProductServiceType,
      sku: initial?.sku ?? "",
      description: initial?.description ?? "",
      unit: initial?.unit ?? "",
      salePrice: initial?.salePrice ? Number(initial.salePrice) : undefined,
      purchasePrice: initial?.purchasePrice ? Number(initial.purchasePrice) : undefined,
      incomeAccountId: initial?.incomeAccountId ?? "",
      expenseAccountId: initial?.expenseAccountId ?? "",
      defaultTaxRateId: initial?.defaultTaxRateId ?? "",
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
        <CardTitle>{initial ? "Edit item" : "New catalog item"}</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" invalid={!!errors.name} {...register("name")} />
              <FormError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="type">Type *</Label>
              <Select id="type" {...register("type")}>
                {PRODUCT_SERVICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...register("sku")} />
            </div>
            <div>
              <Label htmlFor="unit">Unit (e.g. hour, kg)</Label>
              <Input id="unit" {...register("unit")} />
            </div>
            <div>
              <Label htmlFor="salePrice">Sale price</Label>
              <Input
                id="salePrice"
                type="number"
                step="0.0001"
                min={0}
                {...register("salePrice", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
            <div>
              <Label htmlFor="purchasePrice">Purchase price</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.0001"
                min={0}
                {...register("purchasePrice", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
              />
            </div>
            <div>
              <Label htmlFor="incomeAccountId">Income account</Label>
              <Select id="incomeAccountId" {...register("incomeAccountId")}>
                <option value="">—</option>
                {(accounts ?? [])
                  .filter((a) => a.accountType === "REVENUE")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="expenseAccountId">Expense account</Label>
              <Select id="expenseAccountId" {...register("expenseAccountId")}>
                <option value="">—</option>
                {(accounts ?? [])
                  .filter((a) => a.accountType === "EXPENSE")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="defaultTaxRateId">Default tax rate</Label>
              <Select id="defaultTaxRateId" {...register("defaultTaxRateId")}>
                <option value="">—</option>
                {(taxRates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name} ({t.rate}%)
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={2} {...register("description")} />
            </div>
          </div>

          <FormError message={submitError ?? undefined} />

          {initial && initial.isActive ? (
            <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
              <span className="text-zinc-600 dark:text-zinc-400">Deactivate this item.</span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={async () => {
                  if (!confirm("Deactivate this catalog item?")) return;
                  await deactivate.mutateAsync(initial.id);
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
