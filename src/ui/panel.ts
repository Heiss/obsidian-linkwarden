import {
  Editor,
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
import {
  formatQuote,
  hasBlockId,
  blockId,
  blockSeparatorBefore,
  blockSeparatorAfter,
} from "../core/quote";

export const VIEW_TYPE_PANEL = "linkwarden-panel";

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
    // Native Obsidian view toolbar (same structure as the file explorer).
    const header = container.createDiv({ cls: "nav-header" });
    const buttons = header.createDiv({ cls: "nav-buttons-container" });

    const action = (
      icon: string,
      label: string,
      onClick: () => void,
    ): void => {
      const btn = buttons.createDiv({
        cls: "clickable-icon nav-action-button",
        attr: { "aria-label": label },
      });
      setIcon(btn, icon);
      btn.onclick = onClick;
    };

    action("refresh-cw", "Refresh highlights", () => void this.refresh(true));
    action("search", "Link a source (search)", () =>
      this.withEditor((ed) => this.plugin.openLinkPicker(ed)),
    );
    action("upload", "Export note links", () =>
      this.withEditor((ed) => this.plugin.openExport(ed)),
    );
    action("link", "Re-link source under cursor", () =>
      this.withEditor((ed) => this.plugin.relink(ed)),
    );
  }

  /** Run an action against the current note's editor, or warn if none is open. */
  private withEditor(fn: (editor: Editor) => void): void {
    const view = this.markdownViewForCurrentFile();
    if (!view) {
      new Notice("Open the note in a Markdown pane first.");
      return;
    }
    fn(view.editor);
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
    if (h.color) bar.style.setProperty("--lw-highlight-color", h.color);

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

  /** The open Markdown view showing the note this panel is bound to, if any. */
  private markdownViewForCurrentFile(): MarkdownView | null {
    if (!this.currentFile) return null;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file === this.currentFile) {
        return view;
      }
    }
    return null;
  }

  /** F4 — materialize a highlight as a callout at the cursor, with dedupe. */
  private insertQuote(binding: Binding, h: Highlight): void {
    // Clicking the panel makes it the active view, so we can't rely on the
    // active Markdown view — find the note's editor by file instead.
    const view = this.markdownViewForCurrentFile();
    if (!view) {
      new Notice("Open the note in a Markdown pane to insert.");
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

    const value = editor.getValue();

    // In reading mode there is no live cursor, so append at the end of the
    // document; otherwise insert at the cursor / replace the selection.
    if (view.getMode() === "preview") {
      const prefix = blockSeparatorBefore(value);
      const last = editor.lastLine();
      const end = { line: last, ch: editor.getLine(last).length };
      editor.replaceRange(`${prefix}${quote}\n`, end);
    } else {
      // Pad with blank lines so the callout is its own block regardless of what
      // sits directly above/below the cursor (a callout glued to the previous
      // line renders merged into it).
      const from = editor.posToOffset(editor.getCursor("from"));
      const to = editor.posToOffset(editor.getCursor("to"));
      const prefix = blockSeparatorBefore(value.slice(0, from));
      const suffix = blockSeparatorAfter(value.slice(to));
      editor.replaceSelection(`${prefix}${quote}${suffix}`);
    }
    new Notice(`Inserted ^${blockId(h.id)}.`);
  }
}

function sortHighlights(highlights: Highlight[]): Highlight[] {
  return [...highlights].sort((a, b) => a.startOffset - b.startOffset);
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
