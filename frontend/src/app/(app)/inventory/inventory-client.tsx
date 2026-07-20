"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/client";
import {
  useCreateMovement,
  useCreateWarehouse,
  useStockLevels,
  useStockMovements,
  useWarehouses,
  type CreateMovementInput,
  type StockLevel,
} from "@/lib/queries/inventory";
import { useCatalog } from "@/lib/queries/catalog";

type Tab = "levels" | "movements" | "warehouses";

const MOVEMENT_TYPES = [
  "GOODS_RECEIPT",
  "GOODS_ISSUE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN_IN",
  "RETURN_OUT",
] as const;

export function InventoryClient() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("levels");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("inventory.title")}</h1>
          <p className="text-sm text-zinc-500">{t("inventory.description")}</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {(["levels", "movements", "warehouses"] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === key
                ? "bg-white shadow dark:bg-zinc-700"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            }`}
          >
            {t(`inventory.tab${key.charAt(0).toUpperCase() + key.slice(1)}`)}
          </button>
        ))}
      </div>

      {tab === "levels" && <StockLevelsTab />}
      {tab === "movements" && <MovementsTab />}
      {tab === "warehouses" && <WarehousesTab />}
    </div>
  );
}

// ===================== Stock Levels Tab =====================

function StockLevelsTab() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [whFilter, setWhFilter] = useState("");
  const { data: warehouses } = useWarehouses();
  const { data, isLoading } = useStockLevels({
    page,
    limit: 30,
    warehouseId: whFilter || undefined,
  });
  const levels = data?.data ?? [];
  const meta = data?.meta;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">{t("inventory.stockOnHand")}</CardTitle>
          <Select value={whFilter} onChange={(e) => { setWhFilter(e.target.value); setPage(1); }}>
            <option value="">{t("inventory.allWarehouses")}</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
            ))}
          </Select>
          {meta && <span className="ml-auto text-xs text-zinc-500">{meta.total} {t("inventory.items")}</span>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-zinc-500">{t("common.loading")}</p>
        ) : levels.length === 0 ? (
          <p className="py-6 text-center text-zinc-500">{t("inventory.noStock")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-3">{t("inventory.product")}</th>
                  <th className="pb-2 pr-3">SKU</th>
                  <th className="pb-2 pr-3">{t("inventory.warehouse")}</th>
                  <th className="pb-2 pr-3 text-right">{t("inventory.inQty")}</th>
                  <th className="pb-2 pr-3 text-right">{t("inventory.outQty")}</th>
                  <th className="pb-2 text-right">{t("inventory.onHand")}</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((row) => (
                  <LevelRow key={`${row.warehouseId}-${row.productServiceId}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              ←
            </Button>
            <span className="text-sm">{page} / {meta.totalPages}</span>
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.totalPages}>
              →
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LevelRow({ row }: { row: StockLevel }) {
  const qty = row.quantityOnHand;
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3 font-medium">{row.productName}</td>
      <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{row.sku ?? "—"}</td>
      <td className="py-2 pr-3">{row.warehouseCode}</td>
      <td className="py-2 pr-3 text-right text-emerald-600">{row.totalIn}</td>
      <td className="py-2 pr-3 text-right text-red-500">{row.totalOut}</td>
      <td className="py-2 text-right font-bold">
        <Badge variant={qty > 0 ? "success" : qty < 0 ? "danger" : "default"}>
          {qty} {row.unit ?? ""}
        </Badge>
      </td>
    </tr>
  );
}

// ===================== Movements Tab =====================

function MovementsTab() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useStockMovements({ page, limit: 20 });
  const movements = data?.data ?? [];
  const meta = data?.meta;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("inventory.movements")}</CardTitle>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? t("common.cancel") : t("inventory.newMovement")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && <NewMovementForm onDone={() => setShowForm(false)} />}
        {isLoading ? (
          <p className="py-6 text-center text-zinc-500">{t("common.loading")}</p>
        ) : movements.length === 0 ? (
          <p className="py-6 text-center text-zinc-500">{t("inventory.noMovements")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2 pr-3">{t("inventory.date")}</th>
                  <th className="pb-2 pr-3">{t("inventory.movementType")}</th>
                  <th className="pb-2 pr-3">{t("inventory.product")}</th>
                  <th className="pb-2 pr-3">{t("inventory.warehouse")}</th>
                  <th className="pb-2 pr-3 text-right">{t("inventory.qty")}</th>
                  <th className="pb-2">{t("inventory.reference")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-xs">{new Date(m.movementDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={m.type.includes("IN") || m.type === "GOODS_RECEIPT" ? "success" : "danger"}>
                        {t(`inventory.types.${m.type}`)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">{m.productService.name}</td>
                    <td className="py-2 pr-3 text-xs">{m.warehouse.code}</td>
                    <td className="py-2 pr-3 text-right font-mono">{Number(m.quantity)}</td>
                    <td className="py-2 text-xs text-zinc-500">{m.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>←</Button>
            <span className="text-sm">{page} / {meta.totalPages}</span>
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.totalPages}>→</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewMovementForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const { data: warehouses } = useWarehouses();
  const { data: catalogResp } = useCatalog({ limit: 500 });
  const catalog = catalogResp?.data ?? [];
  const products = catalog.filter((c) => c.type === "PRODUCT");
  const create = useCreateMovement();
  const [error, setError] = useState("");

  const [form, setForm] = useState<CreateMovementInput>({
    warehouseId: "",
    productServiceId: "",
    type: "GOODS_RECEIPT",
    quantity: 1,
    movementDate: new Date().toISOString().slice(0, 10),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await create.mutateAsync(form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>{t("inventory.warehouse")}</Label>
          <Select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
            <option value="">{t("inventory.selectWarehouse")}</option>
            {warehouses?.filter((w) => w.isActive).map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("inventory.product")}</Label>
          <Select value={form.productServiceId} onChange={(e) => setForm({ ...form, productServiceId: e.target.value })}>
            <option value="">{t("inventory.selectProduct")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("inventory.movementType")}</Label>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {MOVEMENT_TYPES.map((mt) => (
              <option key={mt} value={mt}>{t(`inventory.types.${mt}`)}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t("inventory.qty")}</Label>
          <Input type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
        </div>
        <div>
          <Label>{t("inventory.unitCost")}</Label>
          <Input type="number" min="0" step="0.01" value={form.unitCost ?? ""} onChange={(e) => setForm({ ...form, unitCost: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <Label>{t("inventory.date")}</Label>
          <Input type="date" value={form.movementDate} onChange={(e) => setForm({ ...form, movementDate: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t("inventory.reference")}</Label>
          <Input value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value || undefined })} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={create.isPending} disabled={!form.warehouseId || !form.productServiceId}>
        {t("inventory.createMovement")}
      </Button>
    </form>
  );
}

// ===================== Warehouses Tab =====================

function WarehousesTab() {
  const t = useT();
  const { data: warehouses, isLoading } = useWarehouses();
  const [showForm, setShowForm] = useState(false);
  const create = useCreateWarehouse();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await create.mutateAsync({ code: code.trim(), name: name.trim() });
      setShowForm(false);
      setCode("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("inventory.warehouses")}</CardTitle>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? t("common.cancel") : t("inventory.newWarehouse")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form onSubmit={handleCreate} className="mb-4 flex items-end gap-3 rounded-lg border p-4">
            <div>
              <Label>{t("inventory.warehouseCode")}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WH-01" />
            </div>
            <div className="flex-1">
              <Label>{t("inventory.warehouseName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("inventory.warehouseNamePlaceholder")} />
            </div>
            <Button type="submit" loading={create.isPending} disabled={!code.trim() || !name.trim()}>
              {t("common.create")}
            </Button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}
        {isLoading ? (
          <p className="py-6 text-center text-zinc-500">{t("common.loading")}</p>
        ) : !warehouses?.length ? (
          <p className="py-6 text-center text-zinc-500">{t("inventory.noWarehouses")}</p>
        ) : (
          <div className="space-y-2">
            {warehouses.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <span className="font-mono text-sm font-medium">{w.code}</span>
                  <span className="mx-2 text-zinc-400">—</span>
                  <span>{w.name}</span>
                  {w.address && <span className="ml-2 text-xs text-zinc-500">({w.address})</span>}
                </div>
                <div className="flex items-center gap-2">
                  {w.isDefault && <Badge variant="success">{t("inventory.default")}</Badge>}
                  {!w.isActive && <Badge variant="danger">{t("inventory.inactive")}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
