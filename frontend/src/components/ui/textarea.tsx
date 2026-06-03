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
        "flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors",
        "placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-offset-1",
        "dark:bg-zinc-950 dark:text-zinc-50",
        invalid
          ? "border-red-500 focus-visible:ring-red-500"
          : "border-zinc-300 focus-visible:border-zinc-500 focus-visible:ring-zinc-500 dark:border-zinc-700",
        className,
      )}
      {...rest}
    />
  );
});
