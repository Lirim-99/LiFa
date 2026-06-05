"use client";

import { BuildingOffice2Icon, ChevronUpDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { useSwitchCompany } from "@/lib/queries/companies";
import type { UserCompanyAccessSummary } from "@/lib/types";

interface Props {
  companies: UserCompanyAccessSummary[];
  activeCompanyId: string | null;
}

export function CompanySwitcher({ companies, activeCompanyId }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const switchCompany = useSwitchCompany();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (companies.length === 0) {
    return (
      <Link
        href="/companies/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        {t("companySwitcher.createFirst")}
      </Link>
    );
  }

  const active =
    companies.find((c) => c.companyId === activeCompanyId) ??
    companies.find((c) => c.isDefault) ??
    companies[0];

  const handleSwitch = async (companyId: string) => {
    setOpen(false);
    if (companyId === active.companyId) return;
    await switchCompany.mutateAsync(companyId);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <BuildingOffice2Icon className="h-4 w-4 text-slate-400" />
        <span className="max-w-45 truncate font-medium">
          {active.tradeName ?? active.legalName}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {active.roleCode}
        </Badge>
        <ChevronUpDownIcon className="h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:text-slate-500">
            {t("companySwitcher.yourCompanies")}
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {companies.map((c) => {
              const isActive = c.companyId === active.companyId;
              return (
                <li key={c.companyId}>
                  <button
                    type="button"
                    onClick={() => handleSwitch(c.companyId)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
                      isActive && "bg-sky-50/60 dark:bg-sky-950/30",
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {c.tradeName ?? c.legalName}
                      </span>
                      {c.tradeName ? (
                        <span className="truncate text-xs text-slate-500">{c.legalName}</span>
                      ) : null}
                    </span>
                    <Badge
                      variant={isActive ? "info" : "outline"}
                      className="shrink-0 text-[10px]"
                    >
                      {c.roleCode}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/companies/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40"
            >
              <PlusIcon className="h-4 w-4" />
              {t("companySwitcher.addAnother")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
