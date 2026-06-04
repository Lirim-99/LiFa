import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors",
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
