import { Editor, Modal, Notice, TFile, setIcon } from "obsidian";
import type LinkwardenPlugin from "../main";
import type { LinkwardenClient } from "../api/client";
import {
  buildExportItems,
  applyRewrites,
  type ExportItem,
  type Rewrite,
} from "../core/exportPlan";
import { formatBindingLink, linkLabel } from "../core/binding";
import { resolveArchive } from "./archive";
import { t } from "../i18n";

/** One found link plus where it lives: `null` file → the active editor. */
interface Entry {
  item: ExportItem;
  file: TFile | null;
}

/** Yield a macrotask so the modal's progress bar can actually repaint. */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

/**
 * F3 — scan external URLs (this note, or the whole vault) and archive the chosen
 * ones, rewriting each in place to its Linkwarden binding deep URL. The active
 * note is rewritten through the editor (undo-friendly); other notes are rewritten
 * atomically on disk via `Vault.process`.
 */
type RowStatus = "idle" | "working" | "done" | "failed";

export class ExportModal extends Modal {
  private entries: Entry[] = [];
  private selected = new Set<number>();
  /** True while a scan or archive run is in progress (locks the controls). */
  private busy = false;

  // Per-entry DOM handles, rebuilt on every render() so a run can update rows
  // live without redrawing the whole list.
  private rowEls: HTMLElement[] = [];
  private statusEls: HTMLElement[] = [];
  /** Every interactive control, so a run can disable them all at once. */
  private controls: (HTMLButtonElement | HTMLInputElement)[] = [];
  private archiveBtn!: HTMLButtonElement;
  private runProgressEl!: HTMLElement;

  constructor(
    private readonly plugin: LinkwardenPlugin,
    private readonly client: LinkwardenClient,
    private readonly editor: Editor,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    const base = this.plugin.baseUrl;
    this.entries = buildExportItems(this.editor.getValue(), base).map((item) => ({
      item,
      file: null,
    }));
    this.preselectNew();
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private preselectNew(): void {
    this.selected.clear();
    this.entries.forEach((e, i) => {
      if (!e.item.alreadyLinked) this.selected.add(i);
    });
  }

  /**
   * Group entry indices by their source note, in first-seen order. Entries from
   * the active editor (`file === null`) group under the active note. Headers show
   * each note's vault-absolute path (from the vault root, e.g. `Folder/Note.md`).
   */
  private groupEntries(): { label: string; indices: number[] }[] {
    const activeLabel =
      this.plugin.app.workspace.getActiveFile()?.path ?? t().export.currentNote;
    const order: string[] = [];
    const byKey = new Map<string, { label: string; indices: number[] }>();
    this.entries.forEach((e, i) => {
      const key = e.file ? e.file.path : "\0active";
      let group = byKey.get(key);
      if (!group) {
        group = { label: e.file ? e.file.path : activeLabel, indices: [] };
        byKey.set(key, group);
        order.push(key);
      }
      group.indices.push(i);
    });
    return order.map((k) => byKey.get(k)!);
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.rowEls = [];
    this.statusEls = [];
    this.controls = [];
    contentEl.createEl("h3", { text: t().export.title });

    const controls = contentEl.createDiv({ cls: "lw-export-controls" });
    const newCount = this.entries.filter((e) => !e.item.alreadyLinked).length;
    controls.createSpan({
      text:
        this.entries.length === 0
          ? t().export.noExternalLinks
          : t().export.counts(newCount, this.entries.length - newCount),
    });

    const btns = controls.createDiv();
    const scanAll = btns.createEl("button", { text: t().export.scanVault });
    scanAll.onclick = () => void this.scanVault();
    this.controls.push(scanAll);
    if (this.entries.length > 0) {
      const selAll = btns.createEl("button", { text: t().export.selectAllNew });
      selAll.onclick = () => {
        this.preselectNew();
        this.render();
      };
      const selNone = btns.createEl("button", { text: t().export.selectNone });
      selNone.onclick = () => {
        this.selected.clear();
        this.render();
      };
      this.controls.push(selAll, selNone);
    }

    if (this.entries.length === 0) {
      contentEl.createEl("p", {
        text: t().export.nothingHere,
        cls: "lw-panel-empty",
      });
      return;
    }

    const list = contentEl.createDiv({ cls: "lw-export-list" });
    for (const group of this.groupEntries()) {
      list.createDiv({
        cls: "lw-export-group",
        text: group.label,
        attr: { title: group.label },
      });
      for (const i of group.indices) {
        const { item } = this.entries[i];
        const row = list.createDiv({
          cls: `lw-export-row${item.alreadyLinked ? " is-linked" : ""}`,
        });
        this.rowEls[i] = row;
        const cb = row.createEl("input", { type: "checkbox" });
        cb.checked = this.selected.has(i);
        cb.disabled = item.alreadyLinked;
        cb.onchange = () => {
          if (cb.checked) this.selected.add(i);
          else this.selected.delete(i);
          this.updateArchiveLabel();
        };
        this.controls.push(cb);
        const label = row.createSpan({
          cls: "lw-export-label",
          attr: { title: item.link.url },
        });
        label.createSpan({ text: item.label });
        // Trailing status icon: a green check once a link is (or becomes) a binding.
        this.statusEls[i] = row.createSpan({ cls: "lw-export-status" });
        this.setStatus(i, item.alreadyLinked ? "done" : "idle");
      }
    }

    const footer = contentEl.createDiv({ cls: "lw-export-footer" });
    this.runProgressEl = footer.createDiv({ cls: "lw-progress lw-run-progress" });
    this.archiveBtn = footer.createEl("button", { cls: "mod-cta" });
    this.archiveBtn.onclick = () => void this.run();
    this.controls.push(this.archiveBtn);
    this.updateArchiveLabel();
  }

  private updateArchiveLabel(): void {
    this.archiveBtn?.setText(t().export.archiveSelected(this.selected.size));
  }

  /** Update one row's trailing status icon (and highlight it while working). */
  private setStatus(i: number, state: RowStatus): void {
    const el = this.statusEls[i];
    if (!el) return;
    el.empty();
    el.removeClasses(["is-working", "is-done", "is-failed"]);
    this.rowEls[i]?.toggleClass("is-working", state === "working");
    if (state === "working") {
      el.addClass("is-working");
      setIcon(el, "loader-2");
    } else if (state === "done") {
      el.addClass("is-done");
      setIcon(el, "check");
    } else if (state === "failed") {
      el.addClass("is-failed");
      setIcon(el, "x");
    }
  }

  private setControlsDisabled(disabled: boolean): void {
    for (const c of this.controls) c.disabled = disabled;
  }

  /** Replace the modal body with a progress bar for the current long task. */
  private renderProgress(done: number, total: number, label: string): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: t().export.title });
    const wrap = contentEl.createDiv({ cls: "lw-progress" });
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    wrap.createDiv({
      cls: "lw-progress-label",
      text: `${label} ${done}/${total}`,
    });
    const track = wrap.createDiv({ cls: "lw-progress-track" });
    track.createDiv({ cls: "lw-progress-bar" }).style.width = `${pct}%`;
  }

  /** Crawl every markdown note in the vault and collect its external links. */
  private async scanVault(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const base = this.plugin.baseUrl;
    const { vault, workspace } = this.plugin.app;
    const activePath = workspace.getActiveFile()?.path;
    const files = vault.getMarkdownFiles();

    this.renderProgress(0, files.length, t().export.scanning);
    const entries: Entry[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // The active note may have unsaved edits, so read it from the editor and
      // rewrite it there; other notes are read from the cache (cheap) and later
      // rewritten on disk.
      const isActive = file.path === activePath;
      const text = isActive
        ? this.editor.getValue()
        : await vault.cachedRead(file);
      for (const item of buildExportItems(text, base)) {
        entries.push({ item, file: isActive ? null : file });
      }
      // Repaint the bar every so often (and on the final file).
      if (i % 20 === 0 || i === files.length - 1) {
        this.renderProgress(i + 1, files.length, t().export.scanning);
        await yieldToPaint();
      }
    }

    this.entries = entries;
    this.preselectNew();
    this.busy = false;
    this.render();
  }

  private async run(): Promise<void> {
    if (this.busy) return;
    // Entry indices to archive, in document order, skipping ones already linked.
    const order = [...this.selected]
      .filter((i) => this.entries[i] && !this.entries[i].item.alreadyLinked)
      .sort((a, b) => a - b);

    if (order.length === 0) {
      new Notice(t().export.nothingSelected);
      return;
    }

    this.busy = true;
    this.setControlsDisabled(true);
    const bar = this.beginRunProgress(order.length);

    // Archive each URL, marking its row live, then bucket the rewrites by target
    // (the editor vs each on-disk file) so every file is rewritten in one pass.
    const editorRewrites: Rewrite[] = [];
    const fileRewrites = new Map<string, { file: TFile; rewrites: Rewrite[] }>();
    let ok = 0;

    for (let n = 0; n < order.length; n++) {
      const i = order[n];
      const { item, file } = this.entries[i];
      this.setStatus(i, "working");
      this.rowEls[i]?.scrollIntoView({ block: "nearest" });
      await yieldToPaint();

      const link = await resolveArchive(this.plugin, this.client, item.link.url);
      if (link) {
        const rw: Rewrite = {
          link: item.link,
          href: this.plugin.deepLinkFor(link.id),
          fallbackLabel: linkLabel(link),
        };
        if (file === null) {
          editorRewrites.push(rw);
        } else {
          const bucket = fileRewrites.get(file.path) ?? { file, rewrites: [] };
          bucket.rewrites.push(rw);
          fileRewrites.set(file.path, bucket);
        }
        this.entries[i].item.alreadyLinked = true;
        this.selected.delete(i);
        this.setStatus(i, "done");
        ok++;
      } else {
        this.setStatus(i, "failed");
      }
      bar.update(n + 1);
      await yieldToPaint();
    }

    // Active-editor rewrites: apply from the end so earlier offsets stay valid.
    for (const rw of editorRewrites.sort((a, b) => b.link.start - a.link.start)) {
      this.rewriteInEditor(rw);
    }
    // On-disk rewrites: one atomic process() per file.
    for (const { file, rewrites } of fileRewrites.values()) {
      await this.plugin.app.vault.process(file, (data) =>
        applyRewrites(data, rewrites),
      );
    }

    this.busy = false;
    new Notice(t().export.archivedAndLinked(ok, order.length));
    // Keep the modal open so the green checks stay visible; repurpose the button.
    this.archiveBtn.disabled = false;
    this.archiveBtn.setText(t().export.close);
    this.archiveBtn.onclick = () => this.close();
  }

  /** Reveal and drive the inline archive progress bar; returns an updater. */
  private beginRunProgress(total: number): { update(done: number): void } {
    const wrap = this.runProgressEl;
    wrap.empty();
    wrap.addClass("is-visible");
    const label = wrap.createDiv({
      cls: "lw-progress-label",
      text: t().export.archivingProgress(0, total),
    });
    const fill = wrap
      .createDiv({ cls: "lw-progress-track" })
      .createDiv({ cls: "lw-progress-bar" });
    return {
      update: (done: number) => {
        label.setText(t().export.archivingProgress(done, total));
        fill.style.width = `${Math.round((done / total) * 100)}%`;
      },
    };
  }

  /** Replace one link in the active editor with a binding. */
  private rewriteInEditor(rw: Rewrite): void {
    const { link, href, fallbackLabel } = rw;
    if (link.kind === "markdown") {
      // Swap just the url, keep the existing text as the fallback label.
      const from = this.editor.offsetToPos(link.urlStart);
      const to = this.editor.offsetToPos(link.urlEnd);
      this.editor.replaceRange(href, from, to);
    } else {
      // Wrap the bare url into a binding link labelled with the url.
      const from = this.editor.offsetToPos(link.start);
      const to = this.editor.offsetToPos(link.end);
      this.editor.replaceRange(
        formatBindingLink(link.url || fallbackLabel, href),
        from,
        to,
      );
    }
  }
}
