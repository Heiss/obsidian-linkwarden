// English strings — the source of truth for the i18n layer. The shape of this
// object IS the `Messages` type; every other locale (see `de.ts`) is typed as
// `Messages`, so a missing or misnamed key fails typecheck. Leaves are either
// plain strings or functions taking interpolation params. Keep this file free of
// any Obsidian/DOM import so it stays trivially serializable and testable.

export const en = {
  // main.ts — ribbon, command palette, and the shared "not configured" warning.
  plugin: {
    ribbonTooltip: "Linkwarden highlights",
    notConfigured:
      "Linkwarden: set the instance URL and access token in settings first.",
    commands: {
      openPanel: "Open highlight panel",
      linkPicker: "Link a source (search)",
      exportLinks: "Export note links",
      relink: "Re-link source under cursor",
    },
  },

  // panel.ts — the F2 highlight sidebar.
  panel: {
    displayText: "Linkwarden highlights",
    openNoteToSee: "Open a note to see its Linkwarden highlights.",
    setUrlInSettings: "Set your Linkwarden instance URL in settings.",
    noLinksInNote: "No Linkwarden links in this note.",
    loading: "Loading highlights…",
    noHighlightsYet:
      "No highlights yet. Mark passages in Linkwarden, then refresh.",
    notConfiguredOffline: "Not configured / offline.",
    openInPaneFirst: "Open the note in a Markdown pane first.",
    openInPaneToInsert: "Open the note in a Markdown pane to insert.",
    insertAsQuote: "Insert as quote",
    alreadyInserted: (blockId: string) => `Already inserted (^${blockId}).`,
    inserted: (blockId: string) => `Inserted ^${blockId}.`,
    actions: {
      refresh: "Refresh highlights",
      link: "Link a source (search)",
      export: "Export note links",
      relink: "Re-link source under cursor",
    },
  },

  // picker.ts — the F1 search modal (also reused by F5 re-link).
  picker: {
    searchPlaceholder: "Search Linkwarden… (or pick a recent link)",
    fetchFailed: (msg: string) => `Linkwarden fetch failed: ${msg}`,
    searchFailed: (msg: string) => `Linkwarden search failed: ${msg}`,
    archiveSuggestion: (url: string) => `Archive “${url}” to Linkwarden`,
    noMatchCreateNew: "No match found — create a new link.",
    archived: (id: number) => `Archived to Linkwarden (#${id}).`,
  },

  // relink.ts — the F5 re-link command.
  relink: {
    placeCursorOnLink: "Place the cursor on a Linkwarden link to re-link it.",
    relinked: (id: number) => `Re-linked to #${id}.`,
    searchPlaceholder: "Search for the new Linkwarden link…",
  },

  // archive.ts — the shared archive-to-Linkwarden helper (F3 / F1 fallback).
  archive: {
    existsButNotLocated: "Linkwarden: link exists but could not be located.",
    unexpectedResponse: "Linkwarden: unexpected response while archiving.",
    failed: (msg: string) => `Linkwarden archive failed: ${msg}`,
  },

  // exportModal.ts — the F3 batch export modal.
  export: {
    title: "Export links to Linkwarden",
    noExternalLinks: "No external links found.",
    counts: (newCount: number, linked: number) =>
      `${newCount} new · ${linked} already linked`,
    scanVault: "Scan entire vault",
    selectAllNew: "Select all new",
    selectNone: "Select none",
    nothingHere: "Nothing to export here. Try scanning the whole vault.",
    currentNote: "Current note",
    archiveSelected: (count: number) => `Archive ${count} selected`,
    scanning: "Scanning notes…",
    nothingSelected: "Nothing selected.",
    archivingProgress: (done: number, total: number) =>
      `Archiving… ${done}/${total}`,
    archivedAndLinked: (ok: number, total: number) =>
      `Linkwarden: archived & linked ${ok}/${total}.`,
    close: "Close",
  },

  // settingsTab.ts — the settings pane (declarative + imperative paths share these).
  settings: {
    baseUrlName: "Instance base URL",
    baseUrlDesc:
      "Your Linkwarden URL, used for API calls and binding deep links. " +
      "Defaults to Linkwarden Cloud; change it if you self-host.",
    tokenName: "Access token",
    tokenDeclarativeDesc: "Access token used to reach your Linkwarden instance.",
    tokenIntro:
      "Generate one in Linkwarden under Settings → Access Tokens → Create Access Token, then paste it here. ",
    tokenStorageSecret:
      "Stored in Obsidian's device-local SecretStorage — never enters the synced vault. Enter once per device.",
    tokenStorageFallback:
      "SecretStorage unavailable (needs Obsidian ≥ 1.11.5, Linux needs kwallet/libsecret). Falls back to storing in the vault settings.",
    connectionName: "Connection",
    connectionDesc:
      "Check that the base URL and access token can reach your Linkwarden instance.",
    testConnection: "Test connection",
    testing: "Testing…",
    setUrlAndTokenFirst: "Set the base URL and access token first.",
    deepLinkName: "Deep-link target",
    deepLinkDesc:
      "Where binding links point. Public collections can be shared without login.",
    deepLinkLinks: "/links (detail page)",
    deepLinkPreserved: "/preserved (reader)",
    deepLinkPublic: "/public/links (no login)",
    collectionName: "Default collection",
    collectionDesc:
      'Target collection for exports. "Unorganized" is Linkwarden\'s default.',
    collectionUnorganized: "Unorganized (Linkwarden default)",
    collectionNotInList: (name: string) => `${name} (not in list)`,
    collectionReload: "Reload collections from Linkwarden",
    collectionSetUrlFirst:
      "Linkwarden: set the instance URL and access token first.",
    collectionLoadFailed: (msg: string) =>
      `Linkwarden: could not load collections — ${msg}`,
    cacheTtlName: "Highlight cache TTL (minutes)",
    cacheTtlDesc:
      "How long cached highlights stay fresh before a refetch. 0 = always refetch.",
    colorMapHeading: "Color mapping",
    colorMapAbout: "About color mapping",
    colorMapDesc:
      "Map each Linkwarden highlight color to a callout type and an optional tag for the insert action.",
    colorCalloutPlaceholder: "Callout type (quote)",
    colorTagPlaceholder: "Tag (optional)",
    colorRemove: "Remove",
    addColor: "Add a color",
    addColorPlaceholder: "Color value from Linkwarden",
    add: "Add",
  },
};

export type Messages = typeof en;
