"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/client";
import { useJournalEntries } from "@/lib/queries/journal-entries";
import type { JournalEntry } from "@/lib/types";
import { JournalEntryEditor } from "./journal-entry-editor";

type Status = "" | "DRAFT" | "POSTED";

export function JournalEntriesClient() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>("");
  const [sourceType, setSourceType] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const params = {
    page,
    limit: 25,
    status: status === "" ? undefined : status,
    sourceType: sourceType || undefined,
  };
  const { data, isLoading } = useJournalEntries(params);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="status">{t("common.status")}</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as Status);
                }}
              >
                <option value="">{t("common.all")}</option>
                <option value="DRAFT">{t("enums.journalEntryStatus.DRAFT")}</option>
                <option value="POSTED">{t("enums.journalEntryStatus.POSTED")}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="sourceType">{t("journal.source")}</Label>
              <Select
                id="sourceType"
                value={sourceType}
                onChange={(e) => {
                  setPage(1);
                  setSourceType(e.target.value);
                }}
              >
                <option value="">{t("common.all")}</option>
                <option value="MANUAL">{t("journal.sourceManual")}</option>
                <option value="INVOICE">{t("journal.sourceInvoice")}</option>
                <option value="PAYMENT">{t("journal.sourcePayment")}</option>
                <option value="INVOICE_VOID">{t("journal.sourceInvoiceVoid")}</option>
                <option value="PAYMENT_VOID">{t("journal.sourcePaymentVoid")}</option>
              </Select>
            </div>
            <div className="ml-auto">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setShowNew((v) => !v);
                }}
              >
                {showNew ? t("common.cancel") : t("journal.newManualEntry")}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <JournalEntryEditor onDone={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
      ) : null}

      {editingId ? (
        <JournalEntryEditor
          id={editingId}
          onDone={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>{t("journal.entryNumber")}</Th>
                <Th>{t("journal.date")}</Th>
                <Th>{t("journal.source")}</Th>
                <Th>{t("journal.memo")}</Th>
                <Th>{t("common.status")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : !data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    {t("journal.empty")}
                  </td>
                </tr>
              ) : (
                data.data.map((e) => <Row key={e.id} entry={e} onOpen={() => setEditingId(e.id)} />)
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {t("common.pagination", {
              page: data.page,
              totalPages: data.totalPages,
              total: data.total,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t("common.previous")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ entry, onOpen }: { entry: JournalEntry; onOpen: () => void }) {
  const t = useT();
  const reversed = !!entry.reversedByEntryId;
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <Td className="font-mono text-xs">
        {entry.entryNumber ?? <span className="text-zinc-400">{t("journal.draft")}</span>}
      </Td>
      <Td>{entry.entryDate.slice(0, 10)}</Td>
      <Td>
        <Badge variant="outline">{entry.sourceDocumentType ?? "MANUAL"}</Badge>
      </Td>
      <Td className="text-zinc-600 dark:text-zinc-400">{entry.memo ?? "—"}</Td>
      <Td>
        <Badge variant={entry.status === "POSTED" ? "success" : "warning"}>
          {t(`enums.journalEntryStatus.${entry.status}`)}
        </Badge>
        {reversed ? (
          <Badge variant="danger" className="ml-1">
            {t("journal.reversed")}
          </Badge>
        ) : null}
      </Td>
      <Td className="text-right">
        <Button size="sm" variant="ghost" onClick={onOpen}>
          {t("common.open")}
        </Button>
      </Td>
    </tr>
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
