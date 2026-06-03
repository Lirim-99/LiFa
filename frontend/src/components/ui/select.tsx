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
        "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:bg-zinc-950 dark:text-zinc-50",
        invalid
          ? "border-red-500 focus-visible:ring-red-500"
          : "border-zinc-300 focus-visible:border-zinc-500 focus-visible:ring-zinc-500 dark:border-zinc-700",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
