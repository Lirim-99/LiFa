import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:bg-slate-950 dark:text-slate-50",
        invalid
          ? "border-rose-400 focus-visible:ring-rose-400"
          : "border-slate-200 focus-visible:border-sky-500 focus-visible:ring-sky-400 dark:border-slate-700",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
