"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import { useDeleteRate, useExchangeRates, useUpsertRate } from "@/lib/queries/exchange-rates";

const COMMON_CURRENCIES = ["USD", "GBP", "CHF", "ALL", "RSD", "MKD", "BAM"];

export function ExchangeRatesClient() {
  const t = useT();
  const { data: rates, isLoading } = useExchangeRates();
  const upsertRate = useUpsertRate();
  const deleteRate = useDeleteRate();

  const [currency, setCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleAdd = () => {
    if (!currency || !rate) return;
    upsertRate.mutate(
      { targetCurrency: currency.toUpperCase(), rate: Number(rate), effectiveDate: date },
      { onSuccess: () => { setCurrency(""); setRate(""); } },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("exchangeRates.title")}</h1>
        <p className="text-sm text-zinc-500">{t("exchangeRates.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("exchangeRates.addRate")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>{t("exchangeRates.currency")}</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  placeholder="USD"
                  className="w-24"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
                <div className="flex gap-1">
                  {COMMON_CURRENCIES.map((c) => (
                    <button
                      key={c}
                      className="rounded border px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => setCurrency(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label>{t("exchangeRates.rate")} (1 EUR = ?)</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                className="w-32"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("exchangeRates.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button onClick={handleAdd} disabled={upsertRate.isPending}>
              {t("exchangeRates.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("exchangeRates.currentRates")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-zinc-500">{t("common.loading")}</p>}
          {!isLoading && (!rates || rates.length === 0) && (
            <p className="py-6 text-center text-sm text-zinc-400">{t("exchangeRates.noRates")}</p>
          )}
          {rates && rates.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="pb-2 pr-3">{t("exchangeRates.pair")}</th>
                  <th className="pb-2 pr-3">{t("exchangeRates.rate")}</th>
                  <th className="pb-2 pr-3">{t("exchangeRates.date")}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">
                      {r.baseCurrency}/{r.targetCurrency}
                    </td>
                    <td className="py-2 pr-3">{Number(r.rate).toFixed(4)}</td>
                    <td className="py-2 pr-3 text-xs">
                      {new Date(r.effectiveDate).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => deleteRate.mutate(r.id)}
                      >
                        &times;
                      </Button>
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
