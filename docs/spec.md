# Obsidian ↔ Linkwarden Plugin — Requirements / Spec

_As of: 2026-07-20 · **Status: v1.3 — decisions D1–D6 made** · build-ready_

> **When picking this back up:** The design is fully decided. Next step =
> build the plugin scaffold (manifest, `requestUrl` client, picker, panel,
> insert action, export modal). F5/F6 are optional extensions.

## Core idea

Show highlights from Linkwarden as a **living reading aid** next to the active
note — rather than materializing them as files. No sync engine, no
merge/clobber problem. Guiding principle: **read in Linkwarden, write in
Obsidian.** Materializing highlights happens only deliberately and opt-in
(see F4).

## Architecture decisions made

- **Form factor:** Obsidian plugin (TypeScript). Mandatory, because the panel is
  UI and only runs in-app. The server-side daemon approach is dropped for this
  track.
- **Binding via stable `linkId`** (integer PK from the Linkwarden schema), not
  via URL matching. This eliminates the entire normalization/`contains` class of
  errors: the binding is unambiguous as soon as the id is in the note.
- **API access via Obsidian `requestUrl`**, not `fetch` (bypasses CORS at the
  Electron level).
- **Persistent cache** → the panel works offline with (possibly slightly stale)
  highlights.
- **Auth:** Linkwarden access token (Bearer/JWT). Stored via Obsidian's
  **SecretStorage API**, not in `data.json` → the token never leaves the synced
  vault. Details in Security / Operations (D6).

## Functional requirements

### F1 — Link picker (link via search)
- A command with an assignable hotkey opens a `SuggestModal`.
- Typing → query against `GET /api/v1/search?searchQueryString=…`
  (performs a server-side `contains` over name / url / description / tags).
- The result list shows title, URL, collection, tags.
- Selecting inserts a **Markdown link at the cursor position whose target is the
  instance deep URL** (`<base>/links/<id>`) and whose **text** carries the
  readable label. The link *is* the binding — the id lives in the href, no
  separate id/url field to maintain (single source of truth).
  ```markdown
  See [On RAG — example.org](https://links.my-instance.tld/links/842).
  ```
  - `<base>` comes from the plugin settings (the same instance URL as for the API).
  - Target via **settings toggle**, default `/links/<id>` (detail page: metadata,
    original + all formats — preferred, especially on a public instance).
    Alternative `/preserved/<id>` (direct reader). Public collections:
    `/public/links/<id>` is clickable/shareable without login.
  - **Link text = fallback:** original URL or title as the label → the note stays
    readable if the instance is ever unreachable. No second maintained source,
    just the label of the same link.
- **Red-team consequences (D1):** (a) host coupling — a domain/instance change
  requires a vault-wide find/replace of the host (the id survives); (b)
  `/links/<id>` needs a session → for clickability without login, make the
  reading collection public (`/public/links/<id>`).
- Note: the search endpoint does **not** embed highlights; a highlight count in
  the list would only be possible with N follow-up loads → deliberately omitted.

### F2 — Highlight panel (display)
- A dedicated `ItemView` as a sidebar panel (right).
- Reacts to `file-open` / `active-leaf-change` (debounced).
- Finds the bindings by **scanning the note's external links** and matching the
  href against `<base>/(links|preserved|public/links)/(\d+)` → extracts `<id>`,
  fetches `GET /api/v1/links/{id}/highlights` per source. External links are not
  in the `metadataCache` → body parsing (exclude code fences etc.); accepted
  deliberately as the price of zero duplication.
- Renders highlights **grouped per source**: `text`, `comment` (note/thought),
  color bar (`color`).
- Sorted within a source by `startOffset` (reading order).
- "Refresh" button + cache TTL instead of live polling.

### F3 — Export/archive to Linkwarden (track A, integrated)
- **Batch export modal (core):** A command scans the external URLs of the active
  note and shows them as a **checkbox list**. The user picks what should go to
  Linkwarden → per selection `POST /api/v1/links`; afterward the existing body
  link is **rewritten** to the instance deep URL `<base>/links/<id>` (text stays
  as fallback → binding format as in F1). Select-all/none switch.
  - **Duplicates (D5):** Requires `preventDuplicateLinks` enabled in Linkwarden.
    Normal case (new URL) → one `POST`. If the server responds "Link already
    exists", follow up with a `/search` to fetch the existing id and bind the
    body link to it (instead of a duplicate). Caveat: the server only normalizes
    trailing slash + www; tracking-param variants slip through.
  - Label per entry: the Markdown link text from `[text](url)`, otherwise the URL.
  - Status per URL: **already linked** (href already points to `<base>/links/<id>`
    → grayed out, not preselected) vs. **new** (preselected) — "archive everything
    new" is thus one click.
  - Target collection: configurable default (setting, e.g. "Reading"),
    overridable in the modal. Without one, Linkwarden files it under
    "Unorganized".
- **On-the-fly from the picker (F1):** If the search returns no hit, the same
  modal offers the "archive URL" action → `POST /links`, bind immediately.
- **Async:** Linkwarden archives asynchronously via a worker; the export ends at
  "created + linked", without waiting for preserved/readable. Highlights appear
  later via F2, once read/marked in Linkwarden.
- _Build note:_ Parse URLs for the scan from the note text (external URLs are
  **not** in the `metadataCache`); exclude code blocks, inline code,
  `[[wikilinks]]` and image embeds. The parsing may be fuzzy — the checkbox
  confirmation is the safety net (unlike silent auto-matching, which we
  deliberately rejected).
- **Closed loop:** Linkwarden = archivist + read-later, Obsidian pulls the
  highlights back via the panel (F2).

### F4 — Insert highlight as a quote (opt-in) **[NEW]**
- Per highlight in the panel, an "insert" action.
- Materializes the highlight at the **current cursor position** as a
  callout/blockquote (`text` + optional `comment`).
- Fully **user-controlled**: the default stays ephemeral (no clutter); adoption
  into the prose happens only deliberately per click.
- No merge engine needed, because the user decides what lands.
- **Format (decided, D2):** Callout `> [!quote]` with block id `^lw-<id>` from the
  Linkwarden highlight id → referenceable via `[[source#^lw-<id>]]`. The callout
  title carries the source link (provenance), `comment` as its own line if
  present. Example:
  ```markdown
  > [!quote] [On RAG](https://example.org/paper)
  > The highlighted text from the article.
  >
  > **Note:** your comment from Linkwarden. ^lw-1571
  ```
  If `comment` is missing, `^lw-1571` moves to the end of the text line.
- **Color mapping (decided, D3):** A settings map maps each highlight color to a
  callout type and/or a tag; the insertion uses it instead of the fixed
  `> [!quote]`. Default suggestion (freely editable), keyed on the color values
  returned by the API:
  - yellow → `> [!quote]`
  - blue → `> [!info]` + `#definition`
  - red → `> [!warning]` + `#objection`
  - green → `> [!success]` + `#idea`
  This turns your colors into searchable vault semantics. The panel (F2) still
  shows the color as a bar.
- **Duplicate protection (mandatory):** Block ids must be unique per note. Before
  inserting, check the note for an existing `^lw-<id>`; if present → don't insert
  again, instead jump the cursor there (or warn).
- _Build note:_ Block-id placement on callouts in Obsidian is a bit peculiar —
  when building, verify briefly that `![[source#^lw-<id>]]` embeds the whole
  callout.

### F5 — Re-link command
- Breaks a binding (link deleted in Linkwarden + recreated → new id); a command
  allows re-linking the source.
- The visible Markdown link in the note stays as a fallback.

### F6 — Browsable Linkwarden tab _(nice-to-have)_
- The same picker also as a full tab (`ItemView`): the entire Linkwarden
  browsable in the Obsidian UI, with collection/tag filter (the API supports
  `collectionId` / `tagId`).

## Settings

- **Instance base URL** (`<base>`) — for API calls *and* as the host of the
  binding deep links.
- **Access token** (Bearer) — create in Linkwarden under Settings → Access
  Tokens; store in the plugin via **SecretStorage** (SecretComponent in the
  settings tab, via `Setting#addComponent()`); the settings only hold the secret
  id.
- **Deep-link target** — toggle `/links` (default) ↔ `/preserved`.
- **Default target collection** for the F3 export (e.g. "Reading"), overridable
  in the modal.
- **Color mapping** (D3) — color → callout type + optional tag for F4.
- **Cache TTL** for highlights (offline capability / refresh behavior).

_Linkwarden-side prerequisite (D5):_ enable `preventDuplicateLinks` in the
Linkwarden user settings so the export duplicate protection works.

## Non-functional / technical requirements

- **Caching:** `linkId → { highlights, fetchedAt }`, TTL invalidation, persisted
  in the plugin state (offline capability).
- **Fallback:** the visible Markdown link always stays intact, in case the
  Linkwarden instance is unreachable.
- **Data-model reference (verified from source):**
  - `Highlight`: `id`, `text`, `comment?`, `color`, `startOffset`, `endOffset`,
    `linkId`, `userId`, `createdAt`, `updatedAt`.
  - Highlights are only retrievable **per link** (`/links/{id}/highlights`); there
    is no "all highlights" endpoint and no "updatedAt ≥ X" filter.

## Security / Operations

- **Token storage (solved via SecretStorage, D6):** Instead of plaintext in
  `.obsidian/plugins/<plugin>/data.json` (which travels via Nextcloud to all
  devices + the Nextcloud), the plugin uses Obsidian's native **SecretStorage
  API** (`setSecret`/`getSecret`/`listSecrets`, since v1.11.4). The value lives in
  Obsidian's device-local, OS-backed store — **not** in the synced vault files.
  The Nextcloud exposure is thereby eliminated; the earlier workaround "exclude
  the plugin folder from sync" is no longer needed.
  - **Version gate:** from **v1.11.5** the store is OS-encrypted *at rest* (in
    v1.11.4 it was still plaintext in LevelDB, readable via PoC) → require at
    least 1.11.5. Linux needs an OS secret backend (kwallet/libsecret).
  - **Consequence:** the secret is device-local and does not sync → enter it once
    per device (desired for a token). Non-sensitive settings keep syncing
    normally.
  - **Pattern:** store the token under a fixed secret id (`linkwarden-token`,
    itself a valid `[a-z0-9-]+`), fetch the value at runtime via `getSecret`.
    The id is a constant, not a user-facing setting. Optional `data.json`
    fallback for Obsidian < 1.11.5.

## Open decisions

- **D1 — Binding storage location:** ✅ decided (revised) → **instance deep link
  as a quote**: Markdown link, target `<base>/links/<id>`, text = readable label
  (fallback). Single source of truth (id in the href), no id/url duplication.
  Details + red-team consequences in F1.
- **D2 — Insert format (F4):** ✅ decided → callout + block id `^lw-<id>`
  (referenceable). Details in F4.
- **D3 — Color semantics & scope:** ✅ decided → **color→callout/tag mapping**
  (configurable, default in F4). No hard scope filter; the panel shows the color
  as a bar. Details in F4.
- **D4 — Back channel:** ✅ decided → **pure pull** (no write-back). `comment` is
  read-only in the panel; Obsidian elaboration is new free text, not an edit of
  the source comment. Zero conflict surface. (Panel write-back remains a possible
  later option.)
- **D5 — Duplicate check on export (F3):** ✅ decided → **server dedupe** via
  `preventDuplicateLinks`; on "already exists" a `/search` to find + bind the
  existing id. Details in F3.
- **D6 — Token storage:** ✅ decided → Obsidian **SecretStorage** instead of
  `data.json` (the token never leaves the synced vault; ≥ v1.11.5, Linux needs
  kwallet/libsecret). Details in Security / Operations.
