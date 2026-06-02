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
        "flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors",
        "placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-offset-1",
        "dark:bg-zinc-950 dark:text-zinc-50",
        invalid
          ? "border-red-500 focus-visible:ring-red-500"
          : "border-zinc-300 focus-visible:border-zinc-500 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:focus-visible:border-zinc-500",
        className,
      )}
      {...rest}
    />
  );
});
