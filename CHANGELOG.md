# Changelog

All notable changes to this plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/Heiss/obsidian-linkwarden/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/Heiss/obsidian-linkwarden/releases/tag/0.1.0
