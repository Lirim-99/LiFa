"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { useSwitchCompany } from "@/lib/queries/companies";
import type { UserCompanyAccessSummary } from "@/lib/types";

interface Props {
  companies: UserCompanyAccessSummary[];
  activeCompanyId: string | null;
}

export function CompanySwitcher({ companies, activeCompanyId }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const switchCompany = useSwitchCompany();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
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
        className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        Create your first company
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
        className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        <span className="font-medium">{active.tradeName ?? active.legalName}</span>
        <Badge variant="outline" className="text-[10px]">
          {active.roleCode}
        </Badge>
        <svg
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
          viewBox="0 0 12 8"
          fill="none"
          aria-hidden
        >
          <path
            d="M1 1l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <ul className="max-h-72 overflow-y-auto py-1">
            {companies.map((c) => {
              const isActive = c.companyId === active.companyId;
              return (
                <li key={c.companyId}>
                  <button
                    type="button"
                    onClick={() => handleSwitch(c.companyId)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      isActive && "bg-zinc-50 dark:bg-zinc-900",
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{c.tradeName ?? c.legalName}</span>
                      {c.tradeName ? (
                        <span className="text-xs text-zinc-500">{c.legalName}</span>
                      ) : null}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.roleCode}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <Link
              href="/companies/new"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            >
              + Add another company
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
