/**
 * Pure translation primitives shared by the server (`server.ts`) and client
 * (`client.tsx`) entry points. No React, no Next — safe to import anywhere.
 */

/** A nested dictionary: values are strings or further nested dictionaries. */
export type Messages = { [key: string]: string | Messages };

export type TranslateVars = Record<string, string | number>;

/** Resolves a dot-path (e.g. "invoices.newInvoice") to a string, or null. */
export function lookup(messages: Messages, key: string): string | null {
  let node: string | Messages | undefined = messages;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) return null;
    node = node[segment];
  }
  return typeof node === "string" ? node : null;
}

/** Interpolates `{name}` placeholders. Leaves unknown placeholders untouched. */
export function format(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Deep-merges `override` onto `base`, returning a new dictionary. Used to layer
 * a (possibly partial) translation on top of the English source so any missing
 * key degrades to English instead of showing a raw key path.
 */
export function mergeMessages(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      typeof value === "object" &&
      value !== null &&
      typeof existing === "object" &&
      existing !== null
    ) {
      out[key] = mergeMessages(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export type TranslateFn = (key: string, vars?: TranslateVars) => string;

/**
 * Resolves the i18n-key `label` of each option in an enum-style array (see
 * `src/lib/types.ts`) to display text for the active locale.
 */
export function translateOptions<T extends { value: string; label: string }>(
  options: readonly T[],
  t: TranslateFn,
): { value: T["value"]; label: string }[] {
  return options.map((o) => ({ value: o.value, label: t(o.label) }));
}

/**
 * Builds a `t(key, vars?)` function bound to a dictionary. Missing keys fall
 * back to the key itself so untranslated strings are visible but never crash.
 */
export function makeT(messages: Messages): TranslateFn {
  return (key, vars) => {
    const template = lookup(messages, key);
    if (template === null) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] missing translation key: ${key}`);
      }
      return key;
    }
    return format(template, vars);
  };
}
