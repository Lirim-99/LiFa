import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors",
        "placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-offset-1",
        "dark:bg-slate-950 dark:text-slate-50",
        invalid
          ? "border-rose-400 focus-visible:ring-rose-400"
          : "border-slate-200 focus-visible:border-sky-500 focus-visible:ring-sky-400 dark:border-slate-700",
        className,
      )}
      {...rest}
    />
  );
});
