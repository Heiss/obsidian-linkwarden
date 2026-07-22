import { Editor, Notice, Plugin, WorkspaceLeaf, getLanguage } from "obsidian";
import { LinkwardenClient } from "./api/client";
import type { CollectionSummary } from "./api/models";
import { HighlightCache, type CacheData } from "./core/cache";
import { buildDeepLink } from "./core/urls";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type LinkwardenSettings,
} from "./settings";
import { obsidianHttp } from "./obsidian/httpAdapter";
import { createTokenStore, type TokenStore } from "./obsidian/tokenStore";
import { LinkwardenSettingTab } from "./ui/settingsTab";
import { HighlightPanel, VIEW_TYPE_PANEL } from "./ui/panel";
import { LinkPicker } from "./ui/picker";
import { ExportModal } from "./ui/exportModal";
import { runRelinkCommand } from "./ui/relink";
import { formatBindingLink, linkLabel } from "./core/binding";
import { initI18n, t } from "./i18n";

interface PersistedData {
  settings?: Partial<LinkwardenSettings>;
  cache?: CacheData;
}

export default class LinkwardenPlugin extends Plugin {
  settings: LinkwardenSettings = { ...DEFAULT_SETTINGS };
  /** Collections last fetched from the instance, for the settings picker. */
  collections: CollectionSummary[] = [];
  cache!: HighlightCache;
  tokenStore!: TokenStore;

  async onload(): Promise<void> {
    initI18n(getLanguage());
    const data = (await this.loadData()) as PersistedData | null;
    this.settings = mergeSettings(data?.settings);
    this.cache = new HighlightCache(this.settings.cacheTtlMinutes, data?.cache);
    this.tokenStore = createTokenStore(
      this.app,
      () => this.settings.tokenSecretId,
      {
        get: () => this.settings.tokenFallback,
        set: (v) => {
          this.settings.tokenFallback = v;
          void this.saveData(this.serialize());
        },
      },
    );

    this.registerView(
      VIEW_TYPE_PANEL,
      (leaf) => new HighlightPanel(leaf, this),
    );

    this.addRibbonIcon("highlighter", t().plugin.ribbonTooltip, () => {
      void this.activatePanel();
    });

    this.addCommand({
      id: "open-panel",
      name: t().plugin.commands.openPanel,
      callback: () => void this.activatePanel(),
    });

    this.addCommand({
      id: "link-picker",
      name: t().plugin.commands.linkPicker,
      editorCallback: (editor) => this.openLinkPicker(editor),
    });

    this.addCommand({
      id: "export-note-links",
      name: t().plugin.commands.exportLinks,
      editorCallback: (editor) => this.openExport(editor),
    });

    this.addCommand({
      id: "relink-source",
      name: t().plugin.commands.relink,
      editorCallback: (editor) => this.relink(editor),
    });

    this.addSettingTab(new LinkwardenSettingTab(this.app, this));
  }

  onunload(): void {
    // Views are detached by Obsidian; nothing else to clean up.
  }

  serialize(): PersistedData {
    return { settings: this.settings, cache: this.cache.toJSON() };
  }

  async saveSettings(): Promise<void> {
    this.cache.setTtlMinutes(this.settings.cacheTtlMinutes);
    await this.saveData(this.serialize());
  }

  async saveCache(): Promise<void> {
    await this.saveData(this.serialize());
  }

  /** The instance base URL, or "" if unset. */
  get baseUrl(): string {
    return this.settings.baseUrl.trim();
  }

  /** Build a binding deep link for a link id using the configured target. */
  deepLinkFor(id: number): string {
    return buildDeepLink(this.baseUrl, id, this.settings.deepLinkTarget);
  }

  /** Build an API client, or null if base URL / token are missing. */
  getClient(): LinkwardenClient | null {
    const token = this.tokenStore.get();
    if (!this.baseUrl || !token) return null;
    return new LinkwardenClient(obsidianHttp, {
      baseUrl: this.baseUrl,
      token,
    });
  }

  /**
   * Fetch the instance's collections and cache them on the plugin. Returns null
   * when no client is configured; throws only on a transport/API failure.
   */
  async fetchCollections(): Promise<CollectionSummary[] | null> {
    const client = this.getClient();
    if (!client) return null;
    this.collections = await client.getCollections();
    return this.collections;
  }

  warnNotConfigured(): void {
    new Notice(t().plugin.notConfigured);
  }

  /** F1 — open the search picker and insert a binding at the cursor. */
  openLinkPicker(editor: Editor): void {
    const client = this.getClient();
    if (!client) return this.warnNotConfigured();
    new LinkPicker(this, client, (link) => {
      editor.replaceSelection(
        formatBindingLink(linkLabel(link), this.deepLinkFor(link.id)),
      );
    }).open();
  }

  /** F3 — open the batch export modal for the given editor's note. */
  openExport(editor: Editor): void {
    const client = this.getClient();
    if (!client) return this.warnNotConfigured();
    new ExportModal(this, client, editor).open();
  }

  /** F5 — re-link the binding under the editor's cursor. */
  relink(editor: Editor): void {
    const client = this.getClient();
    if (!client) return this.warnNotConfigured();
    runRelinkCommand(this, client, editor);
  }

  async activatePanel(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null =
      workspace.getLeavesOfType(VIEW_TYPE_PANEL)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_PANEL, active: true });
    }
    if (leaf) await workspace.revealLeaf(leaf);
  }
}
