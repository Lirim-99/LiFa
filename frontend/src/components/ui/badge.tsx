import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "success" | "warning" | "danger" | "info";

const variants: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  outline: "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
