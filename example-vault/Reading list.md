# Reading list — export test

A plain note full of external links, for exercising **F3 · Export note links**.
None of these are bindings yet. Run *Linkwarden: Export note links* (or the
toolbar upload icon) to open the picker, choose which to archive, and watch each
selected link get rewritten in place to a Linkwarden binding.

## To read (new links)

These aren't in the mock Linkwarden yet, so exporting them **creates** a link and
rewrites it to a binding:

- Bare url: https://example.org/attention-is-all-you-need
- Markdown link: [A Pattern Language](https://example.org/pattern-language)
- Another bare one: https://example.org/thinking-fast-and-slow

## Already in Linkwarden (dedup path)

This url already exists on the mock server, so exporting it takes the **D5 dedup
path** — the create is rejected as a duplicate, the plugin searches for the
existing link, and rewrites to that binding instead of making a copy:

- [On RAG (already archived)](https://example.org/on-rag)

## Should be ignored by export

The scanner masks code and embeds, so none of these are offered:

```
https://example.org/inside-a-code-fence
```

An inline `https://example.org/inline-code` url, and a wikilink [[Welcome]] — all
skipped.

<!-- After exporting, the links above become [text](http://localhost:8788/links/<id>) bindings. -->
