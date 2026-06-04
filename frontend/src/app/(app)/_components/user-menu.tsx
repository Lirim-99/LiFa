"use client";

import {
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Props {
  firstName: string;
  lastName: string;
  email: string;
}

export function UserMenu({ firstName, lastName, email }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const initials = ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "U";
  const displayName = `${firstName} ${lastName}`.trim() || email || "Account";

  const logout = async () => {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-linear-to-br from-sky-500 to-teal-400 px-1 py-1 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1"
        aria-label="Open user menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
          {initials}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="truncate text-sm font-semibold">{displayName}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</div>
          </div>
          <div className="py-1">
            <MenuItem icon={UserCircleIcon} label="Profile" disabled hint="coming soon" />
            <MenuItem
              icon={Cog6ToothIcon}
              label="Company settings"
              href="/settings"
              onSelect={() => setOpen(false)}
            />
          </div>
          <div className="border-t border-slate-100 py-1 dark:border-slate-800">
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onSelect,
  disabled,
  hint,
}: {
  icon: typeof Cog6ToothIcon;
  label: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  const cls =
    "flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800";
  const body = (
    <>
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </>
  );
  if (disabled) {
    return (
      <span className={`${cls} cursor-not-allowed opacity-60`}>{body}</span>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onSelect}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onSelect}>
      {body}
    </button>
  );
}
