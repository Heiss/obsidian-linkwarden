import { Editor, Notice } from "obsidian";
import type LinkwardenPlugin from "../main";
import type { LinkwardenClient } from "../api/client";
import { extractBindings } from "../core/links";
import { LinkPicker } from "./picker";

/**
 * F5 — re-bind the source under the cursor to a (new) Linkwarden link, e.g.
 * after the link was deleted and recreated with a new id. Only the href is
 * swapped; the visible label is kept as the fallback.
 */
export function runRelinkCommand(
  plugin: LinkwardenPlugin,
  client: LinkwardenClient,
  editor: Editor,
): void {
  const value = editor.getValue();
  const cursor = editor.posToOffset(editor.getCursor());
  const bindings = extractBindings(value, plugin.baseUrl);

  // The binding whose span contains the cursor, else the nearest before it.
  const atCursor =
    bindings.find((b) => cursor >= b.start && cursor <= b.end) ??
    [...bindings].reverse().find((b) => b.end <= cursor);

  if (!atCursor) {
    new Notice("Place the cursor on a Linkwarden link to re-link it.");
    return;
  }

  new LinkPicker(
    plugin,
    client,
    (link) => {
      const href = plugin.deepLinkFor(link.id);
      const from = editor.offsetToPos(atCursor.urlStart);
      const to = editor.offsetToPos(atCursor.urlEnd);
      editor.replaceRange(href, from, to);
      new Notice(`Re-linked to #${link.id}.`);
    },
    "Search for the new Linkwarden link…",
  ).open();
}
