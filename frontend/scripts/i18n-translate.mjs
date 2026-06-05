#!/usr/bin/env node
/**
 * Dev-time auto-translation: keeps Albanian (`sq.json`) in sync with the
 * English source (`en.json`).
 *
 * English is authored by developers. This script finds keys that are missing
 * from sq.json — or whose English source changed since the last run (tracked in
 * .i18n-cache.json) — and machine-translates just those via the Anthropic API,
 * preserving {placeholders}. Existing good translations are never re-translated.
 *
 * Usage:
 *   node scripts/i18n-translate.mjs           # fill missing/stale Albanian keys
 *   node scripts/i18n-translate.mjs --check   # exit 1 if anything is missing/stale (CI)
 *
 * Env:
 *   ANTHROPIC_API_KEY   required (except for --check)
 *   I18N_MODEL          optional, default "claude-sonnet-4-6"
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, "..", "src", "i18n", "messages");
const EN_PATH = join(MESSAGES_DIR, "en.json");
const SQ_PATH = join(MESSAGES_DIR, "sq.json");
const CACHE_PATH = join(__dirname, ".i18n-cache.json");

const TARGET = { code: "sq", name: "Albanian" };
const MODEL = process.env.I18N_MODEL ?? "claude-sonnet-4-6";
const BATCH_SIZE = 50;

const isCheck = process.argv.includes("--check");

// --- JSON helpers ----------------------------------------------------------

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Flatten nested dict to { "a.b.c": "string" }. */
function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

/** Set a dot-path key on a nested object, creating intermediate objects. */
function setPath(obj, path, value) {
  const segments = path.split(".");
  let node = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof node[seg] !== "object" || node[seg] === null) node[seg] = {};
    node = node[seg];
  }
  node[segments[segments.length - 1]] = value;
}

/** Recursively sort object keys so JSON diffs stay stable. */
function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortDeep(value[k])]),
    );
  }
  return value;
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(sortDeep(obj), null, 2) + "\n", "utf8");
}

// --- Anthropic translation -------------------------------------------------

async function translateBatch(entries) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set. Cannot translate.");
    process.exit(1);
  }

  const system =
    `You are a professional UI localizer for "LiFa", an accounting/bookkeeping web app ` +
    `used by small and medium businesses in Kosovo. Translate the given user-interface ` +
    `strings from English into ${TARGET.name} (${TARGET.code}). Rules:\n` +
    `- Use natural, concise ${TARGET.name} suitable for a professional accounting product.\n` +
    `- Use standard Kosovo Albanian accounting/finance terminology.\n` +
    `- Preserve ALL placeholders exactly as written, e.g. {firstName}, {amount}, {count}.\n` +
    `- Preserve surrounding punctuation, symbols (%, €, …, ·), and emoji.\n` +
    `- Do NOT translate product names, account codes, or abbreviations like VAT/NACE/AR/P&L ` +
    `unless a well-established ${TARGET.name} equivalent exists.\n` +
    `- Return ONLY a JSON object mapping each input key to its translated string. No prose.`;

  const payload = Object.fromEntries(entries.map(([k, v]) => [k, v]));
  const userMsg =
    `Translate the values of this JSON object into ${TARGET.name}. ` +
    `Keep the keys identical. Return only the JSON object.\n\n` +
    JSON.stringify(payload, null, 2);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    console.error(`Anthropic API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("Could not parse JSON from model response:\n" + text);
    process.exit(1);
  }
  return JSON.parse(match[0]);
}

// --- Main ------------------------------------------------------------------

async function main() {
  const enFlat = flatten(readJson(EN_PATH, {}));
  const sqFlat = flatten(readJson(SQ_PATH, {}));
  const cache = readJson(CACHE_PATH, {});

  // A key needs (re)translation if it's absent in sq OR its English source
  // differs from what we last translated.
  const stale = Object.entries(enFlat).filter(
    ([key, enValue]) => !(key in sqFlat) || cache[key] !== enValue,
  );

  if (stale.length === 0) {
    console.log("✓ Albanian translations are up to date.");
    return;
  }

  if (isCheck) {
    console.error(`✗ ${stale.length} translation key(s) missing or stale:`);
    for (const [key] of stale.slice(0, 50)) console.error(`  - ${key}`);
    if (stale.length > 50) console.error(`  …and ${stale.length - 50} more`);
    console.error('Run "pnpm i18n:translate" to update sq.json.');
    process.exit(1);
  }

  console.log(`Translating ${stale.length} string(s) → ${TARGET.name} (${MODEL})…`);

  const sqObj = readJson(SQ_PATH, {});
  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const batch = stale.slice(i, i + BATCH_SIZE);
    const translated = await translateBatch(batch);
    for (const [key, enValue] of batch) {
      const value = translated[key];
      if (typeof value === "string") {
        setPath(sqObj, key, value);
        cache[key] = enValue;
      } else {
        console.warn(`  ! no translation returned for "${key}" — leaving as-is`);
      }
    }
    console.log(`  …${Math.min(i + BATCH_SIZE, stale.length)}/${stale.length}`);
  }

  writeJson(SQ_PATH, sqObj);
  writeJson(CACHE_PATH, cache);
  console.log(`✓ Wrote ${SQ_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
