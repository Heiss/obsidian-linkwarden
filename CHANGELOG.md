# Changelog

All notable changes to this plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] - 2026-07-22

### Added

- **Multilingual UI (EN/DE):** every user-facing string now routes through a
  `t()` lookup backed by a per-locale dictionary. English (`src/i18n/en.ts`) is
  the typed source of truth; German (`src/i18n/de.ts`) is enforced to mirror it.
  The active locale comes from Obsidian's `getLanguage()`, falling back to
  English. The dictionaries stay Obsidian-free and unit-testable. (#7)
- A Usage / onboarding section in the README covering the ribbon icon, the
  highlight panel, and the commands, plus a demo GIF. (#6)

## [0.3.2] - 2026-07-22

### Fixed

- **Access token wiring (401 on every request).** The access-token setting
  misused Obsidian's `SecretComponent`: it fed the raw token into `setValue()`
  and stored the component's returned secret *name* as if it were the token, so
  `getClient()` sent `Bearer <name>` and every request failed with HTTP 401
  ("Check the access token"). Settings now persist only the secret *name*
  (`tokenSecretId`, default `linkwarden-token`) and resolve the token value at
  runtime via `getSecret(name)`, with a masked plaintext fallback where
  SecretStorage is unavailable. To prevent a repeat, the two strings are branded
  as distinct nominal types (`SecretName` vs `TokenValue`) and `SecretComponent`
  is routed through a typed wrapper (`mountSecretName`), so the original mistake
  no longer type-checks. Adds `tests/tokenStore.test.ts`; updates D6 in the
  spec. (#4)

## [0.3.1] - 2026-07-21

### Added

- The settings tab now also implements Obsidian's declarative settings API
  (`getSettingDefinitions()`), so on Obsidian 1.13+ the simple settings (base
  URL, deep-link target, cache TTL) appear in the global settings search. The
  custom surfaces (access token, connection test, default-collection picker,
  colour map) are provided through the declarative `render` escape hatch. The
  imperative `display()` path is retained as the fallback for Obsidian < 1.13,
  so `minAppVersion` stays at **1.12.7** ("Path B" dual support). Colour-map
  add/remove re-renders via `update()` on 1.13+ (guarded by
  `requireApiVersion`) and `display()` below it. Progresses #3.

## [0.3.0] - 2026-07-21

### Added

- A "Test connection" button in settings that probes the instance with the
  current base URL and token, reporting success, an auth failure, or an
  unreachable URL. Adds `client.checkConnection()`.
- The link picker (F1) and re-link command (F5) now show the 10 most recent
  Linkwarden links on an empty query, so you can pick a source without typing;
  typing switches to a live search. Adds `client.recent()`.
- A "Network use & privacy" section in the README disclosing the single remote
  service (your Linkwarden instance), what is sent, and that no telemetry is
  collected — per the Obsidian developer policies.
- Build-provenance attestations for the `main.js` and `styles.css` release
  assets, so users can cryptographically verify they were built from this
  repository.

### Changed

- The instance base URL now defaults to Linkwarden Cloud
  (`https://cloud.linkwarden.app`); self-hosters overwrite it in settings. No
  network request is made until an access token is entered.
- Build tooling no longer depends on the `builtin-modules` package; the esbuild
  config now derives the Node built-ins to externalize from `node:module`'s
  `builtinModules` (both bare and `node:`-prefixed forms), per the Obsidian
  community-plugin review.

## [0.2.0] - 2026-07-21

### Added

- **Whole-vault export (F3):** a *Scan entire vault* button in the export modal
  crawls every note (using the cached read for speed) with a progress bar, groups
  the external links it finds under their source note, and archives across the
  vault — rewriting each link in its own file atomically via `Vault.process`.
- **Live status in the export modal:** already-linked URLs show a green check,
  and during a run each link flips from a spinner to a green check as it is
  archived, so it is easy to see what is done and what is in progress.
- **Default collection picker:** the default-collection setting is now a dropdown
  populated from the instance's collections, with a refresh button to reload it.
- ESLint with the official `eslint-plugin-obsidianmd` ruleset (`npm run lint`),
  wired into CI, to keep the plugin aligned with the Obsidian community-plugin
  review guidelines.
- This changelog.
- An OKF knowledge bundle under `knowledge/` capturing dev-workflow gotchas and
  review decisions.

### Changed

- Raised `minAppVersion` to **1.12.7** (the current stable Obsidian).
- The access-token setting now explains how to generate a token in the Linkwarden
  UI (Settings → Access Tokens → Create Access Token).
- Highlight color bars in the panel now drive their color through a
  `--lw-highlight-color` CSS custom property instead of a JavaScript-assigned
  inline style.
- UI strings follow Obsidian's sentence-case guideline (settings labels and the
  color-map placeholders).

### Removed

- The "Secret ID" setting. The access token is now stored under a fixed
  `SecretStorage` id (`linkwarden-token`), so there is nothing to configure.

### Fixed

- `LinkPicker` no longer returns a promise from `onChooseSuggestion`, matching
  the `SuggestModal` contract.
- Awaited `revealLeaf` when activating the highlight panel.
- Removed redundant regex escapes and unnecessary type assertions flagged by the
  Obsidian lint rules.
- `nix run .#obsidian-test` now opens the example vault on macOS by running a
  fully isolated Obsidian instance (`--user-data-dir`), so it never touches the
  user's main Obsidian installation and no longer collides with a running app.

## [0.1.0]

Initial release.

### Added

- **Link picker (F1)** — search your Linkwarden library and insert a Markdown
  link bound to the link's stable id.
- **Highlight panel (F2)** — a right-sidebar view that shows the active note's
  Linkwarden highlights, grouped per source and served from a TTL cache when
  offline.
- **Export / archive (F3)** — list a note's external URLs, POST the selected ones
  to Linkwarden, and rewrite them to binding deep links (server-side
  de-duplication respected).
- **Insert highlight as a quote (F4)** — materialize a highlight at the cursor as
  a callout with a referenceable `^lw-<id>` block id and a configurable
  color→callout/tag map.
- **Re-link (F5)** — re-bind a source whose Linkwarden id changed.
- Access token stored in Obsidian's device-local `SecretStorage` (Obsidian
  ≥ 1.11.5), with a plaintext settings fallback where it is unavailable.

[Unreleased]: https://github.com/Heiss/obsidian-linkwarden/compare/0.3.3...HEAD
[0.3.3]: https://github.com/Heiss/obsidian-linkwarden/compare/0.3.2...0.3.3
[0.3.2]: https://github.com/Heiss/obsidian-linkwarden/compare/0.3.1...0.3.2
[0.3.1]: https://github.com/Heiss/obsidian-linkwarden/compare/0.3.0...0.3.1
[0.3.0]: https://github.com/Heiss/obsidian-linkwarden/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/Heiss/obsidian-linkwarden/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/Heiss/obsidian-linkwarden/releases/tag/0.1.0
