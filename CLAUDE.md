# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Obsidian community plugin for [Linkwarden](https://linkwarden.app). Guiding
principle: **read in Linkwarden, write in Obsidian.** Highlights are shown as a
*living reading aid* beside the active note rather than materialized as files —
so there is deliberately **no sync engine and no merge/clobber problem**.

The full design rationale and the frozen decisions D1–D6 live in
[docs/spec.md](docs/spec.md); read it before changing binding, token storage, or
export/dedup behavior.

## Commands

```bash
npm run dev        # esbuild watch → main.js (development bundle, inline sourcemap)
npm run build      # tsc typecheck (noEmit) THEN production bundle
npm run typecheck  # tsc -noEmit -skipLibCheck only
npm test           # vitest run (all tests under tests/)
npm run test:watch # vitest (watch mode by default)
npm run gen:api    # regenerate src/api/schema.ts from openapi/linkwarden.yaml
```

Run a single test file / test:

```bash
npx vitest run tests/urls.test.ts
npx vitest run -t "parseBindingId"
```

## Architecture

The binding is the whole design: a note is linked to a Linkwarden entry by a
single Markdown link whose href is the instance deep URL (`<base>/links/<id>`).
**The integer id in the href IS the binding** — the single source of truth. The
visible link text is only a human-readable fallback. There is no separate id
field to maintain, and no URL-matching/normalization logic. When touching link
insertion, parsing, or rewriting, preserve this invariant.

Two hard rules shape the code:

- **The API client and all `core/` logic must stay free of any Obsidian
  import.** This is what keeps them unit-testable. Obsidian is only touched in
  `src/main.ts`, `src/ui/`, and `src/obsidian/`.
- **HTTP goes through Obsidian's `requestUrl`, never `fetch`** — it bypasses
  CORS at the Electron level. The client depends on an injected `HttpClient`
  (`src/api/http.ts`) so tests pass a fake; the real one is `obsidianHttp`
  (`src/obsidian/httpAdapter.ts`). `HttpClient` implementations MUST resolve for
  any status (including 4xx/5xx) and reject only on transport failure — the
  client interprets status codes itself (e.g. the "already exists" dedup path in
  `createLink`).

Layers:

- `src/api/` — typed client. `schema.ts` is **generated** (do not hand-edit);
  `models.ts` derives the hand-used types from it; `client.ts` is the thin
  wrapper. `tests/openapi-drift.test.ts` fetches the upstream spec and fails when
  the vendored `openapi/linkwarden.yaml` has drifted — that failure is the signal
  to re-vendor and run `npm run gen:api`.
- `src/core/` — pure, serializable logic (no Obsidian, no I/O): `binding.ts`
  (format the Markdown link), `urls.ts` (build/parse deep-link ids across the
  `links` / `preserved` / `public/links` targets), `links.ts` (parse external
  URLs out of raw markdown — Obsidian's `metadataCache` does not index them, so
  it masks code fences/inline code/wikilinks/images then regex-scans; parsing is
  intentionally fuzzy because the F3 checkbox confirmation is the safety net),
  `quote.ts` (render a highlight as a callout with `^lw-<id>` block id + spacing
  rules), `colorMap.ts` (color → callout/tag), `cache.ts` (TTL cache, injectable
  `now()`), `exportPlan.ts`, `secretId.ts`.
- `src/settings.ts` — settings schema, defaults, and `mergeSettings` deep-merge logic.
- `src/obsidian/` — the Obsidian adapters: `httpAdapter.ts` and `tokenStore.ts`.
- `src/ui/` — the user-facing surfaces, one per feature: `picker.ts` (F1),
  `panel.ts` (F2 sidebar `ItemView`), `exportModal.ts`/`archive.ts` (F3),
  `relink.ts` (F5), `settingsTab.ts`.
- `src/main.ts` — the `Plugin` subclass: registers the view, commands, and
  ribbon; owns settings + cache; builds a client via `getClient()` (returns
  `null` when base URL or token is missing) and deep links via `deepLinkFor()`.

Features map to commands F1 (link picker) / F2 (highlight panel) / F3
(export/archive) / F4 (insert highlight as quote) / F5 (re-link); these labels
are used throughout the code comments and spec.

### Persistence & secrets

`data.json` holds `{ settings, cache }` (see `PersistedData` in `main.ts`;
`serialize()`). The **access token is never in `data.json`** — it goes to
Obsidian's OS-backed `SecretStorage` (requires Obsidian ≥ 1.11.5), with only a
secret *id* in settings. `tokenStore.ts` falls back to a plaintext
`tokenFallback` setting when SecretStorage is unavailable (older Obsidian, or the
demo vault). `mergeSettings` deep-merges `colorMap` so new default keys survive
an upgrade — replicate that pattern for any future nested setting.

## Manual testing with the example vault

`example-vault/` is a ready-to-run Obsidian vault preconfigured to point at a
bundled mock server (`baseUrl: http://localhost:8788`, `tokenFallback:
demo-token`). `example-vault/mock-linkwarden/server.mjs` is a dependency-free
Node stub of the API subset the plugin uses (run with `node
example-vault/mock-linkwarden/server.mjs`, `PORT` env overrides 8788). It does
not check auth. Point Obsidian at `example-vault/` and build to `main.js` to
exercise the UI end-to-end without a real Linkwarden instance.
