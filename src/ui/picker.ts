import { Notice, SuggestModal } from "obsidian";
import type LinkwardenPlugin from "../main";
import type { LinkwardenClient } from "../api/client";
import type { Link } from "../api/models";
import { linkLabel } from "../core/binding";
import { resolveArchive } from "./archive";
import { t } from "../i18n";

type Suggestion =
  | { kind: "link"; link: Link }
  | { kind: "archive"; url: string };

/**
 * Search Linkwarden and resolve to a single Link. Used by the F1 picker and the
 * F5 re-link command via the `onResolved` callback. If the query is a URL with
 * no match, offers to archive it on the fly (F3 integration).
 */
export class LinkPicker extends SuggestModal<Suggestion> {
  /** Recent links shown for the empty query, fetched once per modal. */
  private recentCache: Link[] | null = null;

  constructor(
    private readonly plugin: LinkwardenPlugin,
    private readonly client: LinkwardenClient,
    private readonly onResolved: (link: Link) => void,
    placeholder = t().picker.searchPlaceholder,
  ) {
    super(plugin.app);
    this.setPlaceholder(placeholder);
  }

  async getSuggestions(query: string): Promise<Suggestion[]> {
    const q = query.trim();
    // Empty query → seed with the most recent links so the user can pick one
    // without typing; any input switches to a live search.
    if (!q) {
      try {
        const links = await this.recentLinks();
        return links.map((link) => ({ kind: "link", link }));
      } catch (e) {
        new Notice(t().picker.fetchFailed(errorText(e)));
        return [];
      }
    }
    let links: Link[] = [];
    try {
      links = await this.client.search(q);
    } catch (e) {
      new Notice(t().picker.searchFailed(errorText(e)));
      return [];
    }
    const out: Suggestion[] = links.map((link) => ({ kind: "link", link }));
    if (out.length === 0 && /^https?:\/\/\S+$/i.test(q)) {
      out.push({ kind: "archive", url: q });
    }
    return out;
  }

  private async recentLinks(): Promise<Link[]> {
    if (!this.recentCache) this.recentCache = await this.client.recent(10);
    return this.recentCache;
  }

  renderSuggestion(item: Suggestion, el: HTMLElement): void {
    if (item.kind === "archive") {
      el.createDiv({ text: t().picker.archiveSuggestion(item.url) });
      el.createEl("small", {
        text: t().picker.noMatchCreateNew,
        cls: "lw-suggest-sub",
      });
      return;
    }
    const { link } = item;
    el.createDiv({ text: linkLabel(link) });
    const parts: string[] = [];
    if (link.url) parts.push(link.url);
    if (link.collection?.name) parts.push(`⌂ ${link.collection.name}`);
    const tags = (link.tags ?? []).map((t) => `#${t.name}`).join(" ");
    if (tags) parts.push(tags);
    el.createEl("small", { text: parts.join("  ·  "), cls: "lw-suggest-sub" });
  }

  onChooseSuggestion(item: Suggestion): void {
    if (item.kind === "link") {
      this.onResolved(item.link);
      return;
    }
    void this.archiveAndResolve(item.url);
  }

  private async archiveAndResolve(url: string): Promise<void> {
    const link = await resolveArchive(this.plugin, this.client, url);
    if (link) {
      new Notice(t().picker.archived(link.id));
      this.onResolved(link);
    }
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
