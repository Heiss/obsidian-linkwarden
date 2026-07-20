import {
  ItemView,
  MarkdownView,
  Notice,
  TFile,
  WorkspaceLeaf,
  debounce,
  setIcon,
} from "obsidian";
import type LinkwardenPlugin from "../main";
import type { Highlight } from "../api/models";
import { extractBindings, type Binding } from "../core/links";
import { formatQuote, hasBlockId, blockId } from "../core/quote";

export const VIEW_TYPE_PANEL = "linkwarden-highlights-panel";

interface SourceGroup {
  binding: Binding;
  highlights: Highlight[];
  error?: string;
}

export class HighlightPanel extends ItemView {
  private groups: SourceGroup[] = [];
  private currentFile: TFile | null = null;

  private readonly onActiveChange = debounce(
    () => void this.refresh(false),
    300,
    true,
  );

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: LinkwardenPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_PANEL;
  }

  getDisplayText(): string {
    return "Linkwarden highlights";
  }

  getIcon(): string {
    return "highlighter";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", this.onActiveChange),
    );
    this.registerEvent(this.app.workspace.on("file-open", this.onActiveChange));
    await this.refresh(false);
  }

  async onClose(): Promise<void> {
    // Nothing to release.
  }

  /** Rescan the active note and (re)load highlights. `force` bypasses the cache. */
  async refresh(force: boolean): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    this.currentFile = file;
    this.groups = [];

    if (!file || file.extension !== "md") {
      this.renderMessage("Open a note to see its Linkwarden highlights.");
      return;
    }

    const base = this.plugin.baseUrl;
    if (!base) {
      this.renderMessage("Set your Linkwarden instance URL in settings.");
      return;
    }

    const body = await this.app.vault.cachedRead(file);
    const bindings = extractBindings(body, base);
    if (bindings.length === 0) {
      this.renderMessage("No Linkwarden links in this note.");
      return;
    }

    this.renderMessage("Loading highlights…");
    const client = this.plugin.getClient();

    const groups: SourceGroup[] = [];
    for (const binding of bindings) {
      const cached = force ? undefined : this.plugin.cache.getFresh(binding.id);
      if (cached) {
        groups.push({ binding, highlights: sortHighlights(cached) });
        continue;
      }
      if (!client) {
        // Offline / not configured: show stale cache if any.
        const stale = this.plugin.cache.getEntry(binding.id);
        groups.push({
          binding,
          highlights: stale ? sortHighlights(stale.highlights) : [],
          error: stale ? undefined : "Not configured / offline.",
        });
        continue;
      }
      try {
        const highlights = await client.getHighlights(binding.id);
        this.plugin.cache.set(binding.id, highlights);
        groups.push({ binding, highlights: sortHighlights(highlights) });
      } catch (e) {
        const stale = this.plugin.cache.getEntry(binding.id);
        groups.push({
          binding,
          highlights: stale ? sortHighlights(stale.highlights) : [],
          error: stale ? undefined : errorText(e),
        });
      }
    }
    await this.plugin.saveCache();
    this.groups = groups;
    this.render();
  }

  private renderMessage(text: string): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("lw-panel");
    this.renderHeader(container);
    container.createDiv({ cls: "lw-panel-empty", text });
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "lw-panel-header" });
    header.createSpan({ cls: "lw-panel-title", text: "Linkwarden highlights" });
    const refresh = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "Refresh" },
    });
    setIcon(refresh, "refresh-cw");
    refresh.onclick = () => void this.refresh(true);
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("lw-panel");
    this.renderHeader(container);

    const total = this.groups.reduce((n, g) => n + g.highlights.length, 0);
    if (total === 0 && this.groups.every((g) => !g.error)) {
      container.createDiv({
        cls: "lw-panel-empty",
        text: "No highlights yet. Mark passages in Linkwarden, then refresh.",
      });
      return;
    }

    for (const group of this.groups) {
      const section = container.createDiv({ cls: "lw-source" });
      const title = section.createDiv({ cls: "lw-source-title" });
      const label = group.binding.text?.trim() || group.binding.url;
      const a = title.createEl("a", { text: label, href: group.binding.url });
      a.setAttr("target", "_blank");

      if (group.error) {
        section.createDiv({ cls: "lw-panel-empty", text: group.error });
        continue;
      }
      for (const h of group.highlights) {
        this.renderHighlight(section, group.binding, h);
      }
    }
  }

  private renderHighlight(
    parent: HTMLElement,
    binding: Binding,
    h: Highlight,
  ): void {
    const row = parent.createDiv({ cls: "lw-highlight" });
    const bar = row.createDiv({ cls: "lw-color-bar" });
    if (h.color) bar.style.backgroundColor = h.color;

    const bodyEl = row.createDiv({ cls: "lw-highlight-body" });
    bodyEl.createDiv({ cls: "lw-highlight-text", text: h.text });
    if (h.comment && h.comment.trim()) {
      bodyEl.createDiv({ cls: "lw-highlight-comment", text: h.comment });
    }
    const actions = bodyEl.createDiv({ cls: "lw-highlight-actions" });
    const insert = actions.createEl("button", {
      cls: "lw-highlight-insert",
      text: "Insert as quote",
    });
    insert.onclick = () => this.insertQuote(binding, h);
  }

  /** F4 — materialize a highlight as a callout at the cursor, with dedupe. */
  private insertQuote(binding: Binding, h: Highlight): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file !== this.currentFile) {
      new Notice("Open the source note in edit mode to insert.");
      return;
    }
    const editor = view.editor;
    if (hasBlockId(editor.getValue(), h.id)) {
      new Notice(`Already inserted (^${blockId(h.id)}).`);
      return;
    }
    const label = binding.text?.trim() || binding.url;
    const quote = formatQuote(h, {
      colorMap: this.plugin.settings.colorMap,
      sourceHref: binding.url,
      sourceLabel: label,
    });
    editor.replaceSelection(`${quote}\n`);
  }
}

function sortHighlights(highlights: Highlight[]): Highlight[] {
  return [...highlights].sort((a, b) => a.startOffset - b.startOffset);
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
