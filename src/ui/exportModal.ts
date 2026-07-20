import { Editor, Modal, Notice, Setting } from "obsidian";
import type LinkwardenPlugin from "../main";
import type { LinkwardenClient } from "../api/client";
import { buildExportItems, type ExportItem } from "../core/exportPlan";
import { formatBindingLink, linkLabel } from "../core/binding";
import { resolveArchive } from "./archive";

/**
 * F3 — scan the note's external URLs, let the user pick which to archive, then
 * `POST` each and rewrite its body link to the binding deep URL.
 */
export class ExportModal extends Modal {
  private items: ExportItem[] = [];
  private selected = new Set<number>();

  constructor(
    private readonly plugin: LinkwardenPlugin,
    private readonly client: LinkwardenClient,
    private readonly editor: Editor,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    const base = this.plugin.baseUrl;
    this.items = buildExportItems(this.editor.getValue(), base);
    // Preselect everything new.
    this.items.forEach((it, i) => {
      if (!it.alreadyLinked) this.selected.add(i);
    });
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Export links to Linkwarden" });

    const newCount = this.items.filter((it) => !it.alreadyLinked).length;
    if (this.items.length === 0) {
      contentEl.createEl("p", {
        text: "No external links found in this note.",
        cls: "lw-panel-empty",
      });
      return;
    }

    const controls = contentEl.createDiv({ cls: "lw-export-controls" });
    controls.createEl("span", {
      text: `${newCount} new · ${this.items.length - newCount} already linked`,
    });
    const btns = controls.createDiv();
    const selAll = btns.createEl("button", { text: "Select all new" });
    selAll.onclick = () => {
      this.items.forEach((it, i) => {
        if (!it.alreadyLinked) this.selected.add(i);
      });
      this.render();
    };
    const selNone = btns.createEl("button", { text: "Select none" });
    selNone.onclick = () => {
      this.selected.clear();
      this.render();
    };

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const row = contentEl.createDiv({
        cls: `lw-export-row${it.alreadyLinked ? " is-linked" : ""}`,
      });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = this.selected.has(i);
      cb.disabled = it.alreadyLinked;
      cb.onchange = () => {
        if (cb.checked) this.selected.add(i);
        else this.selected.delete(i);
      };
      row.createEl("span", {
        cls: "lw-export-label",
        text: `${it.label}${it.alreadyLinked ? "  (linked)" : ""}`,
        attr: { title: it.link.url },
      });
    }

    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText(`Archive ${this.selected.size} selected`)
        .setCta()
        .onClick(() => void this.run()),
    );
  }

  private async run(): Promise<void> {
    const chosen = [...this.selected]
      .map((i) => this.items[i])
      .filter((it) => it && !it.alreadyLinked)
      // Rewrite from the end so earlier offsets stay valid.
      .sort((a, b) => b.link.start - a.link.start);

    if (chosen.length === 0) {
      new Notice("Nothing selected.");
      return;
    }

    this.close();
    let ok = 0;
    for (const it of chosen) {
      const link = await resolveArchive(this.plugin, this.client, it.link.url);
      if (!link) continue;
      this.rewrite(it, link.id, linkLabel(link));
      ok++;
    }
    new Notice(`Linkwarden: archived & linked ${ok}/${chosen.length}.`);
  }

  /** Replace the link in the editor with a binding to `id`. */
  private rewrite(it: ExportItem, id: number, fallbackLabel: string): void {
    const href = this.plugin.deepLinkFor(id);
    const { link } = it;
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
