import clsx, { type ClassValue } from "clsx";

/** Tailwind class-name helper. Re-exports clsx with a shorter name. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
