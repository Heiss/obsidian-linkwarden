// German (Deutsch) strings. Typed as `Messages`, so it must mirror `en.ts`
// exactly — any missing or renamed key, or a mismatched interpolation signature,
// fails typecheck. Product names ("Linkwarden", "Obsidian") stay untranslated.

import type { Messages } from "./en";

export const de: Messages = {
  plugin: {
    ribbonTooltip: "Linkwarden-Markierungen",
    notConfigured:
      "Linkwarden: Bitte zuerst Instanz-URL und Zugriffstoken in den Einstellungen hinterlegen.",
    commands: {
      openPanel: "Markierungs-Panel öffnen",
      linkPicker: "Quelle verknüpfen (Suche)",
      exportLinks: "Notiz-Links exportieren",
      relink: "Quelle unter dem Cursor neu verknüpfen",
    },
  },

  panel: {
    displayText: "Linkwarden-Markierungen",
    openNoteToSee: "Öffne eine Notiz, um ihre Linkwarden-Markierungen zu sehen.",
    setUrlInSettings: "Hinterlege deine Linkwarden-Instanz-URL in den Einstellungen.",
    noLinksInNote: "Keine Linkwarden-Links in dieser Notiz.",
    loading: "Markierungen werden geladen…",
    noHighlightsYet:
      "Noch keine Markierungen. Markiere Passagen in Linkwarden und aktualisiere dann.",
    notConfiguredOffline: "Nicht konfiguriert / offline.",
    openInPaneFirst: "Öffne die Notiz zuerst in einem Markdown-Bereich.",
    openInPaneToInsert: "Öffne die Notiz in einem Markdown-Bereich zum Einfügen.",
    insertAsQuote: "Als Zitat einfügen",
    alreadyInserted: (blockId: string) => `Bereits eingefügt (^${blockId}).`,
    inserted: (blockId: string) => `Eingefügt: ^${blockId}.`,
    actions: {
      refresh: "Markierungen aktualisieren",
      link: "Quelle verknüpfen (Suche)",
      export: "Notiz-Links exportieren",
      relink: "Quelle unter dem Cursor neu verknüpfen",
    },
  },

  picker: {
    searchPlaceholder: "Linkwarden durchsuchen… (oder einen letzten Link wählen)",
    fetchFailed: (msg: string) => `Linkwarden-Abruf fehlgeschlagen: ${msg}`,
    searchFailed: (msg: string) => `Linkwarden-Suche fehlgeschlagen: ${msg}`,
    archiveSuggestion: (url: string) => `„${url}“ in Linkwarden archivieren`,
    noMatchCreateNew: "Kein Treffer – einen neuen Link erstellen.",
    archived: (id: number) => `In Linkwarden archiviert (#${id}).`,
  },

  relink: {
    placeCursorOnLink:
      "Setze den Cursor auf einen Linkwarden-Link, um ihn neu zu verknüpfen.",
    relinked: (id: number) => `Neu verknüpft mit #${id}.`,
    searchPlaceholder: "Nach dem neuen Linkwarden-Link suchen…",
  },

  archive: {
    existsButNotLocated:
      "Linkwarden: Link existiert, konnte aber nicht gefunden werden.",
    unexpectedResponse:
      "Linkwarden: unerwartete Antwort beim Archivieren.",
    failed: (msg: string) => `Linkwarden-Archivierung fehlgeschlagen: ${msg}`,
  },

  export: {
    title: "Links nach Linkwarden exportieren",
    noExternalLinks: "Keine externen Links gefunden.",
    counts: (newCount: number, linked: number) =>
      `${newCount} neu · ${linked} bereits verknüpft`,
    scanVault: "Gesamten Tresor durchsuchen",
    selectAllNew: "Alle neuen auswählen",
    selectNone: "Nichts auswählen",
    nothingHere:
      "Hier gibt es nichts zu exportieren. Versuche, den gesamten Tresor zu durchsuchen.",
    currentNote: "Aktuelle Notiz",
    archiveSelected: (count: number) => `${count} ausgewählte archivieren`,
    scanning: "Notizen werden durchsucht…",
    nothingSelected: "Nichts ausgewählt.",
    archivingProgress: (done: number, total: number) =>
      `Wird archiviert… ${done}/${total}`,
    archivedAndLinked: (ok: number, total: number) =>
      `Linkwarden: ${ok}/${total} archiviert & verknüpft.`,
    close: "Schließen",
  },

  settings: {
    baseUrlName: "Instanz-Basis-URL",
    baseUrlDesc:
      "Deine Linkwarden-URL für API-Aufrufe und Binding-Deeplinks. " +
      "Standard ist Linkwarden Cloud; ändere sie, wenn du selbst hostest.",
    tokenName: "Zugriffstoken",
    tokenDeclarativeDesc:
      "Zugriffstoken für den Zugang zu deiner Linkwarden-Instanz.",
    tokenIntro:
      "Erzeuge eines in Linkwarden unter Einstellungen → Zugriffstokens → Zugriffstoken erstellen und füge es hier ein. ",
    tokenStorageSecret:
      "Wird in Obsidians gerätelokalem SecretStorage gespeichert – gelangt nie in den synchronisierten Tresor. Einmal pro Gerät eingeben.",
    tokenStorageFallback:
      "SecretStorage nicht verfügbar (benötigt Obsidian ≥ 1.11.5, unter Linux kwallet/libsecret). Fällt auf die Speicherung in den Tresor-Einstellungen zurück.",
    connectionName: "Verbindung",
    connectionDesc:
      "Prüfe, ob Basis-URL und Zugriffstoken deine Linkwarden-Instanz erreichen.",
    testConnection: "Verbindung testen",
    testing: "Wird getestet…",
    setUrlAndTokenFirst: "Zuerst Basis-URL und Zugriffstoken hinterlegen.",
    deepLinkName: "Deeplink-Ziel",
    deepLinkDesc:
      "Wohin Binding-Links zeigen. Öffentliche Sammlungen lassen sich ohne Anmeldung teilen.",
    deepLinkLinks: "/links (Detailseite)",
    deepLinkPreserved: "/preserved (Leseansicht)",
    deepLinkPublic: "/public/links (ohne Anmeldung)",
    collectionName: "Standard-Sammlung",
    collectionDesc:
      'Zielsammlung für Exporte. „Unorganized“ ist Linkwardens Standard.',
    collectionUnorganized: "Unorganized (Linkwarden-Standard)",
    collectionNotInList: (name: string) => `${name} (nicht in der Liste)`,
    collectionReload: "Sammlungen aus Linkwarden neu laden",
    collectionSetUrlFirst:
      "Linkwarden: Bitte zuerst Instanz-URL und Zugriffstoken hinterlegen.",
    collectionLoadFailed: (msg: string) =>
      `Linkwarden: Sammlungen konnten nicht geladen werden – ${msg}`,
    cacheTtlName: "Cache-Gültigkeit für Markierungen (Minuten)",
    cacheTtlDesc:
      "Wie lange zwischengespeicherte Markierungen gültig bleiben, bevor neu geladen wird. 0 = immer neu laden.",
    colorMapHeading: "Farbzuordnung",
    colorMapAbout: "Über die Farbzuordnung",
    colorMapDesc:
      "Ordne jeder Linkwarden-Markierungsfarbe einen Callout-Typ und optional ein Tag für die Einfügen-Aktion zu.",
    colorCalloutPlaceholder: "Callout-Typ (quote)",
    colorTagPlaceholder: "Tag (optional)",
    colorRemove: "Entfernen",
    addColor: "Farbe hinzufügen",
    addColorPlaceholder: "Farbwert aus Linkwarden",
    add: "Hinzufügen",
  },
};
