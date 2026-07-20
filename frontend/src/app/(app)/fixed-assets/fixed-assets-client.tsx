"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import { useCreateAsset, useFixedAssets, useRunDepreciation, type FixedAsset } from "@/lib/queries/fixed-assets";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "outline"> = {
  ACTIVE: "success",
  FULLY_DEPRECIATED: "warning",
  DISPOSED: "danger",
};

export function FixedAssetsClient() {
  const t = useT();
  const { data: assets, isLoading } = useFixedAssets();
  const runDepreciation = useRunDepreciation();
  const [showForm, setShowForm] = useState(false);
  const [deprDate, setDeprDate] = useState(new Date().toISOString().split("T")[0]);

  const handleDepreciate = () => {
    runDepreciation.mutate(deprDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("fixedAssets.title")}</h1>
          <p className="text-sm text-zinc-500">{t("fixedAssets.description")}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{t("fixedAssets.addAsset")}</Button>
      </div>

      {showForm && <NewAssetForm onDone={() => setShowForm(false)} />}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("fixedAssets.assetRegister")}</CardTitle>
          <div className="flex items-center gap-2">
            <Input type="date" className="w-40" value={deprDate} onChange={(e) => setDeprDate(e.target.value)} />
            <Button size="sm" variant="secondary" onClick={handleDepreciate} disabled={runDepreciation.isPending}>
              {t("fixedAssets.runDepreciation")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-zinc-500">{t("common.loading")}</p>}
          {!isLoading && (!assets || assets.length === 0) && (
            <p className="py-6 text-center text-sm text-zinc-400">{t("fixedAssets.noAssets")}</p>
          )}
          {assets && assets.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="pb-2 pr-3">{t("fixedAssets.assetName")}</th>
                  <th className="pb-2 pr-3">{t("fixedAssets.category")}</th>
                  <th className="pb-2 pr-3">{t("fixedAssets.cost")}</th>
                  <th className="pb-2 pr-3">{t("fixedAssets.accumulated")}</th>
                  <th className="pb-2 pr-3">{t("fixedAssets.nbv")}</th>
                  <th className="pb-2">{t("fixedAssets.status")}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{a.name}</td>
                    <td className="py-2 pr-3 text-xs">{a.category ?? "—"}</td>
                    <td className="py-2 pr-3">&euro;{Number(a.purchaseCost).toFixed(2)}</td>
                    <td className="py-2 pr-3">&euro;{Number(a.accumulatedDepr).toFixed(2)}</td>
                    <td className="py-2 pr-3 font-medium">&euro;{Number(a.netBookValue).toFixed(2)}</td>
                    <td className="py-2">
                      <Badge variant={STATUS_VARIANT[a.status] ?? "outline"}>{a.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewAssetForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const create = useCreateAsset();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [purchaseCost, setPurchaseCost] = useState("");
  const [residualValue, setResidualValue] = useState("0");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("60");

  const handleSubmit = () => {
    if (!name || !purchaseCost) return;
    create.mutate(
      {
        name,
        category: category || undefined,
        purchaseDate,
        purchaseCost: Number(purchaseCost),
        residualValue: Number(residualValue),
        usefulLifeMonths: Number(usefulLifeMonths),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>{t("fixedAssets.assetName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t("fixedAssets.category")}</Label>
            <Input placeholder="Vehicles, Equipment..." value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>{t("fixedAssets.purchaseDate")}</Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div>
            <Label>{t("fixedAssets.cost")} (&euro;)</Label>
            <Input type="number" min="0" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} />
          </div>
          <div>
            <Label>{t("fixedAssets.residualValue")} (&euro;)</Label>
            <Input type="number" min="0" value={residualValue} onChange={(e) => setResidualValue(e.target.value)} />
          </div>
          <div>
            <Label>{t("fixedAssets.usefulLife")} ({t("fixedAssets.months")})</Label>
            <Input type="number" min="1" value={usefulLifeMonths} onChange={(e) => setUsefulLifeMonths(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={create.isPending}>{t("common.save")}</Button>
          <Button variant="secondary" onClick={onDone}>{t("common.cancel")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
