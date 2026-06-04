"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuditLogs, type AuditLogRow } from "@/lib/queries/audit";

const ENTITY_TYPES = [
  "",
  "COMPANY",
  "ACCOUNT",
  "INVOICE",
  "PAYMENT",
  "JOURNAL_ENTRY",
  "USER_ACCESS",
];

export function AuditLogClient() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = {
    page,
    limit: 50,
    entityType: entityType || undefined,
    action: action || undefined,
    occurredFrom: from || undefined,
    occurredTo: to || undefined,
  };
  const { data, isLoading } = useAuditLogs(params);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="entityType">Entity</Label>
              <Select
                id="entityType"
                value={entityType}
                onChange={(e) => {
                  setPage(1);
                  setEntityType(e.target.value);
                }}
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t || "All"}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="action">Action</Label>
              <Input
                id="action"
                placeholder="CREATED, ISSUED, …"
                value={action}
                onChange={(e) => {
                  setPage(1);
                  setAction(e.target.value);
                }}
              />
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => {
                  setPage(1);
                  setFrom(e.target.value);
                }}
              />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => {
                  setPage(1);
                  setTo(e.target.value);
                }}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>When</Th>
                <Th>User</Th>
                <Th>Entity</Th>
                <Th>Action</Th>
                <Th>Reference</Th>
                <Th />
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
                data.data.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    expanded={expanded === row.id}
                    onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
                  />
                ))
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

function Row({
  row,
  expanded,
  onToggle,
}: {
  row: AuditLogRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const userLabel = row.user
    ? `${row.user.firstName} ${row.user.lastName}`.trim() || row.user.email
    : row.userId.slice(0, 8);
  return (
    <>
      <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
        <Td className="whitespace-nowrap font-mono text-xs">
          {new Date(row.occurredAt).toLocaleString()}
        </Td>
        <Td>{userLabel}</Td>
        <Td>
          <Badge variant="outline">{row.entityType}</Badge>
        </Td>
        <Td>
          <Badge>{row.action}</Badge>
        </Td>
        <Td className="font-mono text-xs">{row.entityId.slice(0, 8)}</Td>
        <Td className="text-right">
          {row.beforeJson || row.afterJson ? (
            <Button size="sm" variant="ghost" onClick={onToggle}>
              {expanded ? "Hide" : "Details"}
            </Button>
          ) : null}
        </Td>
      </tr>
      {expanded ? (
        <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-900">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {row.beforeJson ? (
                <div>
                  <div className="text-xs uppercase text-zinc-500">Before</div>
                  <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs dark:bg-zinc-950">
                    {JSON.stringify(row.beforeJson, null, 2)}
                  </pre>
                </div>
              ) : null}
              {row.afterJson ? (
                <div>
                  <div className="text-xs uppercase text-zinc-500">After</div>
                  <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs dark:bg-zinc-950">
                    {JSON.stringify(row.afterJson, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
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
  return <td className={`px-4 py-2 align-top ${className}`}>{children}</td>;
}
