# Linkwarden Highlights — demo

This vault is preconfigured against a **local mock Linkwarden** (started for you by
`nix run .#obsidian-test`), so every feature works without a real server.

Open the **Linkwarden highlights** panel from the right sidebar (or the ribbon
highlighter icon). It scans this note for Linkwarden links and shows their
highlights, grouped per source.

## Bound sources

These two links are *bindings* — the id in the href is the source of truth, the
text is just a readable fallback:

- [On Retrieval-Augmented Generation](http://localhost:8788/links/1)
- [The Nature of Order](http://localhost:8788/links/2)

Try this:

1. **Panel (F2):** open the panel — you'll see highlights in yellow / blue / red
   / green with their comments.
2. **Insert as quote (F4):** put your cursor below and click *Insert as quote* on
   any highlight. It drops a callout with a referenceable block id (`^lw-<id>`).
   Insert the same one twice — it refuses and jumps to the existing block.
3. **Link picker (F1):** run the command *Linkwarden: Link to Linkwarden
   (search)* and type e.g. `order` or `ml`.
4. **Export (F3):** add a plain external link, e.g. https://example.org/new-thing ,
   then run *Linkwarden: Export note links to Linkwarden* and archive it — the
   link is rewritten to a binding.
5. **Re-link (F5):** put the cursor on a binding above and run *Linkwarden:
   Re-link a source*.

<!-- Cursor here for quote inserts: -->
