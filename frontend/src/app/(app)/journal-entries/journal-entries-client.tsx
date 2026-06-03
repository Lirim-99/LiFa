"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useJournalEntries } from "@/lib/queries/journal-entries";
import type { JournalEntry } from "@/lib/types";
import { JournalEntryEditor } from "./journal-entry-editor";

type Status = "" | "DRAFT" | "POSTED";

export function JournalEntriesClient() {
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
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as Status);
                }}
              >
                <option value="">All</option>
                <option value="DRAFT">Draft</option>
                <option value="POSTED">Posted</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="sourceType">Source</Label>
              <Select
                id="sourceType"
                value={sourceType}
                onChange={(e) => {
                  setPage(1);
                  setSourceType(e.target.value);
                }}
              >
                <option value="">All</option>
                <option value="MANUAL">Manual</option>
                <option value="INVOICE">Invoice</option>
                <option value="PAYMENT">Payment</option>
                <option value="INVOICE_VOID">Invoice void</option>
                <option value="PAYMENT_VOID">Payment void</option>
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
                {showNew ? "Cancel" : "+ New manual entry"}
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
                <Th>Entry #</Th>
                <Th>Date</Th>
                <Th>Source</Th>
                <Th>Memo</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : !data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    No entries.
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
            Page {data.page} of {data.totalPages} · {data.total} total
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ entry, onOpen }: { entry: JournalEntry; onOpen: () => void }) {
  const reversed = !!entry.reversedByEntryId;
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <Td className="font-mono text-xs">{entry.entryNumber ?? <span className="text-zinc-400">draft</span>}</Td>
      <Td>{entry.entryDate.slice(0, 10)}</Td>
      <Td>
        <Badge variant="outline">{entry.sourceDocumentType ?? "MANUAL"}</Badge>
      </Td>
      <Td className="text-zinc-600 dark:text-zinc-400">{entry.memo ?? "—"}</Td>
      <Td>
        <Badge variant={entry.status === "POSTED" ? "success" : "warning"}>{entry.status}</Badge>
        {reversed ? (
          <Badge variant="danger" className="ml-1">
            reversed
          </Badge>
        ) : null}
      </Td>
      <Td className="text-right">
        <Button size="sm" variant="ghost" onClick={onOpen}>
          Open
        </Button>
      </Td>
    </tr>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
