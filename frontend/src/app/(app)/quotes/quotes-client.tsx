"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n/client";
import {
  useAcceptQuote,
  useConvertQuoteToOrder,
  useQuotes,
  useRejectQuote,
  useSendQuote,
  type Quote,
} from "@/lib/queries/quotes";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "outline" | "info"> = {
  DRAFT: "outline",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "warning",
  CONVERTED: "default",
};

export function QuotesClient() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data, isLoading } = useQuotes({ page, limit: 25, status: statusFilter || undefined });
  const sendQuote = useSendQuote();
  const acceptQuote = useAcceptQuote();
  const rejectQuote = useRejectQuote();
  const convertToOrder = useConvertQuoteToOrder();

  const quotes = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("quotes.title")}</h1>
          <p className="text-sm text-zinc-500">{t("quotes.description")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <select
              className="rounded-md border bg-white px-3 py-1.5 text-sm dark:bg-zinc-900"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t("quotes.allStatuses")}</option>
              <option value="DRAFT">{t("quotes.statusDraft")}</option>
              <option value="SENT">{t("quotes.statusSent")}</option>
              <option value="ACCEPTED">{t("quotes.statusAccepted")}</option>
              <option value="REJECTED">{t("quotes.statusRejected")}</option>
              <option value="CONVERTED">{t("quotes.statusConverted")}</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-zinc-500">{t("common.loading")}</p>}
          {!isLoading && quotes.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">{t("quotes.noQuotes")}</p>
          )}
          {quotes.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="pb-2 pr-3">{t("quotes.number")}</th>
                  <th className="pb-2 pr-3">{t("quotes.customer")}</th>
                  <th className="pb-2 pr-3">{t("quotes.date")}</th>
                  <th className="pb-2 pr-3">{t("quotes.expiry")}</th>
                  <th className="pb-2 pr-3">{t("quotes.amount")}</th>
                  <th className="pb-2 pr-3">{t("quotes.status")}</th>
                  <th className="pb-2">{t("quotes.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <QuoteRow
                    key={q.id}
                    quote={q}
                    t={t}
                    onSend={() => sendQuote.mutate(q.id)}
                    onAccept={() => acceptQuote.mutate(q.id)}
                    onReject={() => rejectQuote.mutate(q.id)}
                    onConvert={() => convertToOrder.mutate(q.id)}
                  />
                ))}
              </tbody>
            </table>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                {meta.total} {t("quotes.total")}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  &laquo;
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
                  &raquo;
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuoteRow({
  quote,
  t,
  onSend,
  onAccept,
  onReject,
  onConvert,
}: {
  quote: Quote;
  t: ReturnType<typeof useT>;
  onSend: () => void;
  onAccept: () => void;
  onReject: () => void;
  onConvert: () => void;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3 font-mono text-xs">{quote.quoteNumber ?? "—"}</td>
      <td className="py-2 pr-3">{quote.contact.displayName}</td>
      <td className="py-2 pr-3 text-xs">{new Date(quote.issueDate).toLocaleDateString()}</td>
      <td className="py-2 pr-3 text-xs">{new Date(quote.expiryDate).toLocaleDateString()}</td>
      <td className="py-2 pr-3">{quote.currency} {Number(quote.totalAmount).toFixed(2)}</td>
      <td className="py-2 pr-3">
        <Badge variant={STATUS_VARIANT[quote.status] ?? "outline"}>{quote.status}</Badge>
      </td>
      <td className="py-2">
        <div className="flex gap-1">
          {quote.status === "DRAFT" && (
            <Button size="sm" variant="secondary" onClick={onSend}>{t("quotes.send")}</Button>
          )}
          {quote.status === "SENT" && (
            <>
              <Button size="sm" onClick={onAccept}>{t("quotes.accept")}</Button>
              <Button size="sm" variant="secondary" onClick={onReject}>{t("quotes.reject")}</Button>
            </>
          )}
          {quote.status === "ACCEPTED" && (
            <Button size="sm" onClick={onConvert}>{t("quotes.convertToOrder")}</Button>
          )}
        </div>
      </td>
    </tr>
  );
}
