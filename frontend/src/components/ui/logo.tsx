import { cn } from "@/lib/cn";

/**
 * Brand mark — stylized "LiFa" wordmark with a teal accent ledger glyph.
 * Used in the header and the auth screens.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-teal-400 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M4 6h16M4 12h10M4 18h7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        LiFa
      </span>
    </span>
  );
}
