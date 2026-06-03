import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "success" | "warning" | "danger";

const variants: Record<Variant, string> = {
  default: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  outline: "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
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
