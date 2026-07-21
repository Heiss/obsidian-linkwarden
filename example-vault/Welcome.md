# Linkwarden for Obsidian — demo

This vault is preconfigured against a **local mock Linkwarden** (started for you by
`nix run .#obsidian-test`), so every feature works without a real server.

Open the **Linkwarden** panel from the right sidebar (or the ribbon highlighter
icon). It scans this note for Linkwarden links and shows their highlights,
grouped per source. The panel's toolbar (top) has buttons for **Refresh**,
**Link a source**, **Export note links** and **Re-link**.

## Bound sources

These two links are *bindings* — the id in the href is the source of truth, the
text is just a readable fallback:

- [On Retrieval-Augmented Generation](http://localhost:8788/links/1)
- [The Nature of Order](http://localhost:8788/links/2)

Try this:

1. **Panel:** open it — you'll see highlights in yellow / blue / red / green with
   their comments. Clicking a source title opens its (mock) Linkwarden page.
2. **Insert as quote:** put your cursor below and click *Insert as quote* on any
   highlight. It drops a callout with a referenceable block id (`^lw-<id>`).
   Insert the same one twice — it refuses (the id is already in the note).
3. **Link a source:** run *Linkwarden: Link a source (search)* (or the toolbar
   search icon) and type e.g. `order` or `ml`.
4. **Export:** open **Reading list.md** — a note full of plain external links —
   then run *Linkwarden: Export note links* (or the toolbar upload icon) and
   archive some; each is rewritten in place to a binding. In the modal, *Scan
   entire vault* crawls every note (with a progress bar) so you can export links
   from the whole vault at once — those get rewritten on disk in their own notes.
5. **Re-link:** put the cursor on a binding above and run *Linkwarden: Re-link
   source under cursor* (or the toolbar link icon).

<!-- Insert quotes below this line: -->

> [!warning] [On Retrieval-Augmented Generation](http://localhost:8788/links/1) #objection
> Naive chunking can split a claim from its evidence.
>
> **Note:** Objection: watch chunk boundaries. ^lw-1573

> [!info] [On Retrieval-Augmented Generation](http://localhost:8788/links/1) #definition
> A retriever selects passages; a reader conditions on them. ^lw-1572

> [!quote] [On Retrieval-Augmented Generation](http://localhost:8788/links/1)
> Retrieval-augmented generation grounds a model's output in an external corpus.
>
> **Note:** This is the core definition to remember. ^lw-1571
