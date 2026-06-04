import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...rest }, ref) {
    return (
      <label
        ref={ref}
        className={cn(
          "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300",
          className,
        )}
        {...rest}
      />
    );
  },
);
