"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency, formatDate } from "@/i18n/format";
import { useCreditNotes } from "@/lib/queries/credit-notes";
import {
  CREDIT_NOTE_STATUSES,
  CREDIT_NOTE_TYPES,
  type CreditNote,
  type CreditNoteStatus,
  type CreditNoteType,
} from "@/lib/types";
import { CreditNoteEditor } from "./credit-note-editor";

const STATUS_VARIANT: Record<
  CreditNoteStatus,
  "default" | "success" | "warning" | "outline" | "danger" | "info"
> = {
  DRAFT: "warning",
  ISSUED: "info",
  VOID: "danger",
};

export function CreditNotesClient() {
  const t = useT();
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState<CreditNoteType>("SALES");

  const params = {
    page,
    limit: 25,
    status: status || undefined,
    type: type || undefined,
  };
  const { data, isLoading } = useCreditNotes(params);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="type">{t("creditNotes.type")}</Label>
              <Select
                id="type"
                value={type}
                onChange={(e) => {
                  setPage(1);
                  setType(e.target.value);
                }}
              >
                <option value="">{t("common.all")}</option>
                {CREDIT_NOTE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">{t("common.status")}</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
              >
                <option value="">{t("common.all")}</option>
                {CREDIT_NOTE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setNewType("SALES");
                  setShowNew((v) => !v);
                }}
              >
                {showNew ? t("common.cancel") : t("creditNotes.newSalesCN")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setNewType("PURCHASE");
                  setShowNew((v) => !v);
                }}
              >
                {showNew ? t("common.cancel") : t("creditNotes.newPurchaseCN")}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <CreditNoteEditor
          type={newType}
          onDone={() => setShowNew(false)}
          onCancel={() => setShowNew(false)}
        />
      ) : null}

      {editingId ? (
        <CreditNoteEditor
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
                <Th>{t("creditNotes.number")}</Th>
                <Th>{t("creditNotes.type")}</Th>
                <Th>{t("creditNotes.date")}</Th>
                <Th>{t("creditNotes.contact")}</Th>
                <Th className="text-right">{t("creditNotes.total")}</Th>
                <Th>{t("common.status")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : !data?.data.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    {t("creditNotes.empty")}
                  </td>
                </tr>
              ) : (
                data.data.map((cn: CreditNote) => (
                  <tr
                    key={cn.id}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    onClick={() => {
                      setShowNew(false);
                      setEditingId(cn.id);
                    }}
                  >
                    <td className="px-4 py-2 font-medium">
                      {cn.creditNoteNumber ?? t("common.draft")}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={cn.type === "SALES" ? "info" : "default"}>
                        {t(`enums.creditNoteType.${cn.type}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{formatDate(cn.issueDate, locale)}</td>
                    <td className="px-4 py-2">{cn.contact?.displayName ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatCurrency(Number(cn.totalAmount), locale)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={STATUS_VARIANT[cn.status]}>
                        {t(`enums.creditNoteStatus.${cn.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNew(false);
                          setEditingId(cn.id);
                        }}
                      >
                        {t("common.view")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            {t("common.page")} {data.page} / {data.totalPages} ({data.total}{" "}
            {t("common.items")})
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("common.prev")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= (data?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th className={`px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 ${className ?? ""}`}>
      {children}
    </th>
  );
}
