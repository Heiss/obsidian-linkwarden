# Obsidian ↔ Linkwarden Plugin — Anforderungen / Spec

_Stand: 2026-07-20 · **Status: v1.3 — Entscheidungen D1–D6 getroffen** · build-ready_

> **Beim Wiedereinstieg:** Design ist vollständig entschieden. Nächster Schritt =
> Plugin-Gerüst bauen (Manifest, `requestUrl`-Client, Picker, Panel, Insert-Aktion,
> Export-Modal). F5/F6 sind optionale Erweiterungen.

## Kernidee

Highlights aus Linkwarden als **lebendige Lese-Hilfe** neben der aktiven Notiz
anzeigen — nicht als Dateien materialisieren. Kein Sync-Motor, kein
Merge-/Clobber-Problem. Leitmotiv: **in Linkwarden lesen, in Obsidian schreiben.**
Materialisierung von Highlights passiert nur gezielt und opt-in (siehe F4).

## Getroffene Architektur-Entscheidungen

- **Form-Faktor:** Obsidian-Plugin (TypeScript). Zwingend, weil das Panel UI ist
  und nur in-App läuft. Der serverseitige Daemon-Ansatz entfällt für diesen Strang.
- **Binding über stabile `linkId`** (Integer-PK aus dem Linkwarden-Schema), nicht
  über URL-Matching. Damit fällt die gesamte Normalisierungs-/`contains`-Fehlerklasse
  weg: Verknüpfung ist eindeutig, sobald die id in der Notiz steht.
- **API-Zugriff via Obsidian `requestUrl`**, nicht `fetch` (umgeht CORS auf
  Electron-Ebene).
- **Persistenter Cache** → Panel funktioniert auch offline mit (evtl. leicht
  veralteten) Highlights.
- **Auth:** Linkwarden Access Token (Bearer/JWT). Ablage über Obsidians
  **SecretStorage-API**, nicht in `data.json` → das Token verlässt den gesyncten
  Vault nicht. Details in Sicherheit / Betrieb (D6).

## Funktionale Anforderungen

### F1 — Link-Picker (Verknüpfen per Suche)
- Command mit belegbarem Hotkey öffnet ein `SuggestModal`.
- Tippen → Query gegen `GET /api/v1/search?searchQueryString=…`
  (macht serverseitig `contains` über name / url / description / tags).
- Trefferliste zeigt Titel, URL, Collection, Tags.
- Auswahl fügt an der Cursorposition einen **Markdown-Link ein, dessen Ziel die
  Instanz-Deep-URL ist** (`<base>/links/<id>`) und dessen **Text** die lesbare
  Beschriftung trägt. Der Link *ist* die Bindung — die id steckt in der href,
  kein separates id/url-Feld zu pflegen (Single Source of Truth).
  ```markdown
  Siehe [On RAG — example.org](https://links.meine-instanz.tld/links/842).
  ```
  - `<base>` kommt aus den Plugin-Settings (dieselbe Instanz-URL wie für die API).
  - Ziel per **Settings-Toggle**, Default `/links/<id>` (Detailseite: Metadaten,
    Original + alle Formate — bevorzugt, besonders bei öffentlicher Instanz).
    Alternative `/preserved/<id>` (direkt Reader). Öffentliche Collections:
    `/public/links/<id>` ist ohne Login klickbar/teilbar.
  - **Link-Text = Fallback:** Original-URL oder Titel als Beschriftung → die Notiz
    bleibt lesbar, falls die Instanz mal nicht erreichbar ist. Keine zweite
    gepflegte Quelle, nur das Label desselben Links.
- **Red-Team-Konsequenzen (D1):** (a) Host-Kopplung — Domain-/Instanz-Wechsel
  erfordert vault-weites Find/Replace des Hosts (id überlebt); (b) `/links/<id>`
  braucht Session → für Klickbarkeit ohne Login Reading-Collection öffentlich
  schalten (`/public/links/<id>`).
- Hinweis: Der Such-Endpoint bettet Highlights **nicht** ein; Highlight-Zahl
  in der Liste wäre nur mit N Nachladungen möglich → bewusst weggelassen.

### F2 — Highlight-Panel (Anzeige)
- Eigene `ItemView` als Sidebar-Panel (rechts).
- Reagiert auf `file-open` / `active-leaf-change` (entprellt).
- Findet die Bindings, indem es die **externen Links der Notiz scannt** und die
  href gegen `<base>/(links|preserved|public/links)/(\d+)` matcht → extrahiert
  `<id>`, holt je Quelle `GET /api/v1/links/{id}/highlights`. Externe Links stehen
  nicht im `metadataCache` → Body-Parsing (Code-Fences etc. ausschließen);
  bewusst in Kauf genommen als Preis für Null-Duplikation.
- Rendert Highlights **gruppiert pro Quelle**: `text`, `comment` (Notiz/Gedanke),
  Farbbalken (`color`).
- Sortierung innerhalb einer Quelle nach `startOffset` (Lesereihenfolge).
- „Aktualisieren"-Button + Cache-TTL statt Live-Polling.

### F3 — Nach Linkwarden exportieren / archivieren (Strang A, integriert)
- **Batch-Export-Modal (Kern):** Ein Command scannt die externen URLs der
  aktiven Notiz und zeigt sie als **Checkbox-Liste**. Der Nutzer wählt, was nach
  Linkwarden soll → je Auswahl `POST /api/v1/links`; danach wird der bestehende
  Body-Link auf die Instanz-Deep-URL `<base>/links/<id>` **umgeschrieben** (Text
  bleibt als Fallback erhalten → Binding-Format wie F1). Alles-/Nichts-Schalter.
  - **Dubletten (D5):** Voraussetzung `preventDuplicateLinks` in Linkwarden aktiv.
    Normalfall (neue URL) → ein `POST`. Antwortet der Server mit „Link already
    exists", eine `/search` nachschieben, die existierende id holen und den
    Body-Link darauf binden (statt Dublette). Vorbehalt: Server normalisiert nur
    Trailing-Slash + www, Tracking-Param-Varianten rutschen durch.
  - Label je Eintrag: der Markdown-Link-Text aus `[text](url)`, sonst die URL.
  - Status je URL: **bereits verknüpft** (href zeigt schon auf `<base>/links/<id>`
    → ausgegraut, nicht vorausgewählt) vs. **neu** (vorausgewählt) — „archiviere
    alles Neue" ist so ein Klick.
  - Ziel-Collection: konfigurierbarer Default (Setting, z. B. „Reading"), im
    Modal überschreibbar. Ohne Angabe legt Linkwarden „Unorganized" an.
- **On-the-fly aus dem Picker (F1):** Liefert die Suche keinen Treffer, bietet
  dasselbe Modal die Aktion „URL archivieren" → `POST /links`, sofort binden.
- **Async:** Linkwarden archiviert per Worker asynchron; der Export endet bei
  „angelegt + verknüpft", ohne auf preserved/readable zu warten. Highlights
  erscheinen später über F2, sobald in Linkwarden gelesen/markiert wurde.
- _Build-Hinweis:_ URLs für den Scan aus dem Notiz-Text parsen (externe URLs
  stehen **nicht** im `metadataCache`); Code-Blöcke, Inline-Code, `[[Wikilinks]]`
  und Bild-Embeds ausschließen. Das Parsing darf unscharf sein — die
  Checkbox-Bestätigung ist das Sicherheitsnetz (anders als beim stillen
  Auto-Matching, das wir bewusst verworfen haben).
- **Geschlossener Kreis:** Linkwarden = Archivar + Read-Later, Obsidian zieht die
  Highlights über das Panel (F2) zurück.

### F4 — Highlight als Zitat einfügen (opt-in) **[NEU]**
- Pro Highlight im Panel eine „einfügen"-Aktion.
- Materialisiert den Highlight an der **aktuellen Cursorposition** als
  Callout/Blockzitat (`text` + optional `comment`).
- Vollständig **vom Nutzer gesteuert**: Default bleibt ephemer (kein Clutter),
  Übernahme in die Prosa nur gezielt per Klick.
- Kein Merge-Motor nötig, weil der Nutzer entscheidet, was landet.
- **Format (entschieden, D2):** Callout `> [!quote]` mit Block-ID `^lw-<id>`
  aus der Linkwarden-Highlight-id → referenzierbar via `[[quelle#^lw-<id>]]`.
  Callout-Titel trägt den Quell-Link (Provenienz), `comment` als eigene Zeile,
  wenn vorhanden. Beispiel:
  ```markdown
  > [!quote] [On RAG](https://example.org/paper)
  > Der markierte Text aus dem Artikel.
  >
  > **Notiz:** dein Kommentar aus Linkwarden. ^lw-1571
  ```
  Fehlt `comment`, wandert `^lw-1571` ans Ende der Text-Zeile.
- **Farb-Mapping (entschieden, D3):** Eine Settings-Map bildet jede Highlight-Farbe
  auf einen Callout-Typ und/oder einen Tag ab; die Einfügung nutzt sie statt des
  festen `> [!quote]`. Default-Vorschlag (frei änderbar), gekeyed auf die von der
  API gelieferten Farbwerte:
  - gelb → `> [!quote]`
  - blau → `> [!info]` + `#definition`
  - rot → `> [!warning]` + `#einwand`
  - grün → `> [!success]` + `#idee`
  Damit werden deine Farben zu durchsuchbarer Vault-Semantik. Das Panel (F2) zeigt
  die Farbe weiterhin als Balken.
- **Duplikat-Schutz (Pflicht):** Block-IDs müssen pro Notiz eindeutig sein.
  Vor dem Einfügen die Notiz auf ein vorhandenes `^lw-<id>` prüfen; falls
  vorhanden → nicht erneut einfügen, sondern Cursor dorthin springen (oder warnen).
- _Bau-Hinweis:_ Block-ID-Platzierung an Callouts in Obsidian ist etwas
  eigen — beim Bauen kurz verifizieren, dass `![[quelle#^lw-<id>]]` den ganzen
  Callout einbettet.

### F5 — Re-Link Command
- Bricht ein Binding (Link in Linkwarden gelöscht + neu angelegt → neue id),
  erlaubt ein Command, die Quelle neu zu verknüpfen.
- Sichtbarer Markdown-Link in der Notiz bleibt als Fallback erhalten.

### F6 — Browsable Linkwarden-Tab _(nice-to-have)_
- Derselbe Picker auch als voller Tab (`ItemView`): gesamtes Linkwarden im
  Obsidian-UI browsebar, mit Collection-/Tag-Filter
  (API kann `collectionId` / `tagId`).

## Einstellungen (Settings)

- **Instanz-Base-URL** (`<base>`) — für API-Aufrufe *und* als Host der
  Binding-Deep-Links.
- **Access Token** (Bearer) — in Linkwarden unter Settings → Access Tokens
  erzeugen; im Plugin via **SecretStorage** ablegen (SecretComponent im
  Settings-Tab, über `Setting#addComponent()`), in den Settings steht nur die
  Secret-ID.
- **Deep-Link-Ziel** — Toggle `/links` (Default) ↔ `/preserved`.
- **Default-Ziel-Collection** für F3-Export (z. B. „Reading"), im Modal
  überschreibbar.
- **Farb-Mapping** (D3) — Farbe → Callout-Typ + optionaler Tag für F4.
- **Cache-TTL** für Highlights (Offline-Fähigkeit / Refresh-Verhalten).

_Linkwarden-seitige Voraussetzung (D5):_ `preventDuplicateLinks` in den
Linkwarden-User-Settings aktivieren, damit der Export-Dublettenschutz greift.

## Nicht-funktionale / technische Anforderungen

- **Caching:** `linkId → { highlights, fetchedAt }`, TTL-Invalidierung, im
  Plugin-State persistiert (Offline-Fähigkeit).
- **Fallback:** sichtbarer Markdown-Link bleibt immer erhalten, falls die
  Linkwarden-Instanz nicht erreichbar ist.
- **Datenmodell-Referenz (aus Quelle verifiziert):**
  - `Highlight`: `id`, `text`, `comment?`, `color`, `startOffset`, `endOffset`,
    `linkId`, `userId`, `createdAt`, `updatedAt`.
  - Highlights sind **nur pro Link** abrufbar (`/links/{id}/highlights`), es gibt
    keinen „alle Highlights"-Endpoint und keinen „updatedAt ≥ X"-Filter.

## Sicherheit / Betrieb

- **Token-Ablage (gelöst via SecretStorage, D6):** Statt Klartext in
  `.obsidian/plugins/<plugin>/data.json` (das via Nextcloud auf alle Geräte + die
  Nextcloud wandert) nutzt das Plugin Obsidians native **SecretStorage-API**
  (`setSecret`/`getSecret`/`listSecrets`, seit v1.11.4). Der Wert liegt in
  Obsidians geräte-lokalem, OS-gestütztem Store — **nicht** in den gesyncten
  Vault-Dateien. Die Nextcloud-Exposition ist damit beseitigt; der frühere
  Workaround „Plugin-Ordner vom Sync ausnehmen" entfällt.
  - **Version-Gate:** ab **v1.11.5** ist der Store *at rest* OS-verschlüsselt (in
    v1.11.4 lag er noch als Klartext im LevelDB, per PoC auslesbar) → mindestens
    1.11.5 voraussetzen. Linux braucht ein OS-Secret-Backend (kwallet/libsecret).
  - **Konsequenz:** Secret ist geräte-lokal und synct nicht → einmal pro Gerät
    eingeben (für ein Token gewünscht). Nicht-sensible Settings synchronisieren
    weiter normal.
  - **Muster:** in den Settings nur die Secret-ID halten, Wert zur Laufzeit via
    `getSecret` holen; Secret-IDs müssen `[a-z0-9-]+` sein. Optionaler
    `data.json`-Fallback für Obsidian < 1.11.5.

## Offene Entscheidungen

- **D1 — Binding-Speicherort:** ✅ entschieden (überarbeitet) → **Instanz-Deep-Link
  als Zitat**: Markdown-Link, Ziel `<base>/links/<id>`, Text = lesbare Beschriftung
  (Fallback). Single Source of Truth (id in der href), keine id/url-Dopplung.
  Details + Red-Team-Konsequenzen in F1.
- **D2 — Einfüge-Format (F4):** ✅ entschieden → Callout + Block-ID `^lw-<id>`
  (referenzierbar). Details in F4.
- **D3 — Farb-Semantik & Scope:** ✅ entschieden → **Farb→Callout/Tag-Mapping**
  (konfigurierbar, Default in F4). Kein harter Scope-Filter; Panel zeigt Farbe als
  Balken. Details in F4.
- **D4 — Rückkanal:** ✅ entschieden → **reiner Pull** (kein Write-Back). `comment`
  ist im Panel read-only; Obsidian-Elaboration ist neuer Freitext, keine Bearbeitung
  des Quell-Kommentars. Null Konfliktfläche. (Panel-Write-back bleibt als spätere
  Option denkbar.)
- **D5 — Dublettenprüfung beim Export (F3):** ✅ entschieden → **Server-Dedupe**
  via `preventDuplicateLinks`; auf „already exists" eine `/search` zum Finden+Binden
  der existierenden id. Details in F3.
- **D6 — Token-Ablage:** ✅ entschieden → Obsidian **SecretStorage** statt
  `data.json` (Token verlässt den gesyncten Vault nicht; ≥ v1.11.5, Linux braucht
  kwallet/libsecret). Details in Sicherheit / Betrieb.
