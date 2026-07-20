import { Notice, SuggestModal } from "obsidian";
import type LinkwardenPlugin from "../main";
import type { LinkwardenClient } from "../api/client";
import type { Link } from "../api/models";
import { linkLabel } from "../core/binding";
import { resolveArchive } from "./archive";

type Suggestion =
  | { kind: "link"; link: Link }
  | { kind: "archive"; url: string };

/**
 * Search Linkwarden and resolve to a single Link. Used by the F1 picker and the
 * F5 re-link command via the `onResolved` callback. If the query is a URL with
 * no match, offers to archive it on the fly (F3 integration).
 */
export class LinkPicker extends SuggestModal<Suggestion> {
  constructor(
    private readonly plugin: LinkwardenPlugin,
    private readonly client: LinkwardenClient,
    private readonly onResolved: (link: Link) => void,
    placeholder = "Search Linkwarden…",
  ) {
    super(plugin.app);
    this.setPlaceholder(placeholder);
  }

  async getSuggestions(query: string): Promise<Suggestion[]> {
    const q = query.trim();
    if (!q) return [];
    let links: Link[] = [];
    try {
      links = await this.client.search(q);
    } catch (e) {
      new Notice(`Linkwarden search failed: ${errorText(e)}`);
      return [];
    }
    const out: Suggestion[] = links.map((link) => ({ kind: "link", link }));
    if (out.length === 0 && /^https?:\/\/\S+$/i.test(q)) {
      out.push({ kind: "archive", url: q });
    }
    return out;
  }

  renderSuggestion(item: Suggestion, el: HTMLElement): void {
    if (item.kind === "archive") {
      el.createEl("div", { text: `Archive “${item.url}” to Linkwarden` });
      el.createEl("small", {
        text: "No match found — create a new link.",
        cls: "lw-suggest-sub",
      });
      return;
    }
    const { link } = item;
    el.createEl("div", { text: linkLabel(link) });
    const parts: string[] = [];
    if (link.url) parts.push(link.url);
    if (link.collection?.name) parts.push(`⌂ ${link.collection.name}`);
    const tags = (link.tags ?? []).map((t) => `#${t.name}`).join(" ");
    if (tags) parts.push(tags);
    el.createEl("small", { text: parts.join("  ·  "), cls: "lw-suggest-sub" });
  }

  async onChooseSuggestion(item: Suggestion): Promise<void> {
    if (item.kind === "link") {
      this.onResolved(item.link);
      return;
    }
    const link = await resolveArchive(this.plugin, this.client, item.url);
    if (link) {
      new Notice(`Archived to Linkwarden (#${link.id}).`);
      this.onResolved(link);
    }
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
