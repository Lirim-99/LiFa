This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Internationalization (Albanian / English)

The UI is bilingual: **Albanian** (`sq`, the default) and **English** (`en`). Users
switch language from the in-app menu (avatar → Language) or the switcher on the
auth screens; the choice is stored in the `lifa_locale` cookie.

### How it works

- `src/i18n/` — the i18n layer (no external library):
  - `config.ts` — locales, default, cookie name.
  - `messages/en.json` — **the source of truth**, authored by developers.
  - `messages/sq.json` — Albanian, **generated** (see below). Missing keys fall
    back to English at runtime, so a partial catalog never breaks the UI.
  - `server.ts` (`getT()`) for Server Components, `client.tsx` (`useT()`) for
    Client Components, `format.ts` for locale-aware currency/number/date.
- Components reference **keys**, never raw text: `t("invoices.title")`.
- Enum option labels live in `src/lib/types.ts` as i18n keys under `enums.*` and
  are rendered with `t(option.label)`.

### Adding new UI text (the "automatic" part)

1. Use a key in the component and add the English string to `messages/en.json`.
2. Run the auto-translator to fill Albanian for any new/changed keys:

   ```bash
   ANTHROPIC_API_KEY=sk-... pnpm i18n:translate
   ```

   It machine-translates **only** missing or changed strings (tracked in
   `scripts/.i18n-cache.json`), preserves `{placeholders}`, and writes
   `messages/sq.json`. Override the model with `I18N_MODEL` (default
   `claude-sonnet-4-6`).
3. CI / pre-commit can enforce that the catalogs stay in sync:

   ```bash
   pnpm i18n:check   # exits non-zero if any key is missing or stale
   ```

Machine-translated Albanian can be refined by hand at any time — just edit
`messages/sq.json` (no code changes needed).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
