import {
  App,
  DropdownComponent,
  Notice,
  PluginSettingTab,
  requireApiVersion,
  Setting,
  type SettingDefinitionItem,
} from "obsidian";
import type LinkwardenPlugin from "../main";
import type { DeepLinkTarget } from "../core/urls";
import { asTokenValue } from "../core/secretId";
import { mountSecretName } from "../obsidian/secretComponent";
import { t } from "../i18n";

// Dual-support settings tab (Obsidian migration guide "Path B"). On 1.13+
// Obsidian renders declaratively from `getSettingDefinitions()` and skips
// `display()`; on < 1.13 (still the floor, `minAppVersion` 1.12.7) it falls back
// to the imperative `display()`. The two must stay in sync — the simple values
// (base URL, deep-link target, cache TTL) are declarative `control`s on 1.13 so
// they surface in settings search, and imperative `Setting`s below it. The
// custom surfaces (token, connection test, collection picker, colour map) share
// one `Setting`-configuring helper between both paths.
export class LinkwardenSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: LinkwardenPlugin,
  ) {
    super(app, plugin);
  }

  // Declarative definitions (Obsidian ≥ 1.13). Returning a non-empty array makes
  // Obsidian bypass display() on 1.13+.
  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = t().settings;
    return [
      {
        name: s.baseUrlName,
        desc: s.baseUrlDesc,
        control: {
          type: "text",
          key: "baseUrl",
          placeholder: "https://cloud.linkwarden.app",
        },
      },
      {
        name: s.tokenName,
        desc: s.tokenDeclarativeDesc,
        render: (setting) => this.renderTokenSetting(setting),
      },
      {
        name: s.connectionName,
        desc: s.connectionDesc,
        render: (setting) => this.renderConnectionTest(setting),
      },
      {
        name: s.deepLinkName,
        desc: s.deepLinkDesc,
        control: {
          type: "dropdown",
          key: "deepLinkTarget",
          options: {
            links: s.deepLinkLinks,
            preserved: s.deepLinkPreserved,
            "public/links": s.deepLinkPublic,
          },
        },
      },
      {
        name: s.collectionName,
        desc: s.collectionDesc,
        render: (setting) => this.renderCollectionSetting(setting),
      },
      {
        name: s.cacheTtlName,
        desc: s.cacheTtlDesc,
        control: {
          type: "number",
          key: "cacheTtlMinutes",
          placeholder: "60",
          min: 0,
        },
      },
      {
        type: "group",
        heading: s.colorMapHeading,
        items: [
          {
            name: s.colorMapAbout,
            searchable: false,
            render: (setting) => {
              setting.setName("").setDesc(s.colorMapDesc);
            },
          },
          ...Object.keys(this.plugin.settings.colorMap).map((color) => ({
            name: color,
            render: (setting: Setting) => this.renderColorRow(setting, color),
          })),
          {
            name: s.addColor,
            searchable: false,
            render: (setting: Setting) => this.renderAddColorRow(setting),
          },
        ],
      },
    ];
  }

  // Read the value backing a declarative `control` (Obsidian ≥ 1.13). Only the
  // keys used above are handled; the rest live behind a custom `render`.
  getControlValue(key: string): unknown {
    const s = this.plugin.settings;
    switch (key) {
      case "baseUrl":
        return s.baseUrl;
      case "deepLinkTarget":
        return s.deepLinkTarget;
      case "cacheTtlMinutes":
        return s.cacheTtlMinutes;
      default:
        return undefined;
    }
  }

  // Persist a declarative `control` change into `plugin.settings`.
  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    switch (key) {
      case "baseUrl":
        s.baseUrl = String(value).trim();
        break;
      case "deepLinkTarget":
        s.deepLinkTarget = value as DeepLinkTarget;
        break;
      case "cacheTtlMinutes": {
        const n =
          typeof value === "number" ? value : Number.parseInt(String(value), 10);
        s.cacheTtlMinutes = Number.isFinite(n) && n >= 0 ? n : 60;
        break;
      }
      default:
        return;
    }
    await this.plugin.saveSettings();
  }

  // Imperative fallback for Obsidian < 1.13. Obsidian calls display() only when
  // getSettingDefinitions() is absent/empty, so on 1.13+ this is bypassed. The
  // body lives in renderImperative() so the < 1.13 re-render path can reuse it
  // without calling the (1.13-deprecated) display() itself.
  display(): void {
    this.renderImperative();
  }

  private renderImperative(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const m = t().settings;

    new Setting(containerEl)
      .setName(m.baseUrlName)
      .setDesc(m.baseUrlDesc)
      .addText((text) =>
        text
          .setPlaceholder("https://cloud.linkwarden.app")
          .setValue(s.baseUrl)
          .onChange(async (v) => {
            s.baseUrl = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    this.renderTokenSetting(new Setting(containerEl));
    this.renderConnectionTest(new Setting(containerEl));

    new Setting(containerEl)
      .setName(m.deepLinkName)
      .setDesc(m.deepLinkDesc)
      .addDropdown((d) =>
        d
          .addOption("links", m.deepLinkLinks)
          .addOption("preserved", m.deepLinkPreserved)
          .addOption("public/links", m.deepLinkPublic)
          .setValue(s.deepLinkTarget)
          .onChange(async (v) => {
            s.deepLinkTarget = v as DeepLinkTarget;
            await this.plugin.saveSettings();
          }),
      );

    this.renderCollectionSetting(new Setting(containerEl));

    new Setting(containerEl)
      .setName(m.cacheTtlName)
      .setDesc(m.cacheTtlDesc)
      .addText((text) =>
        text
          .setPlaceholder("60")
          .setValue(String(s.cacheTtlMinutes))
          .onChange(async (v) => {
            const n = Number.parseInt(v, 10);
            s.cacheTtlMinutes = Number.isFinite(n) && n >= 0 ? n : 60;
            await this.plugin.saveSettings();
          }),
      );

    this.renderColorMap(containerEl);
  }

  // Rebuild the settings pane after a structural change (colour added/removed).
  // 1.13+ rebuilds the declarative tab via update(); below it we re-run the
  // imperative render directly (not display(), which is 1.13-deprecated).
  private rerender(): void {
    if (requireApiVersion("1.13.0")) {
      this.update();
    } else {
      this.renderImperative();
    }
  }

  private renderTokenSetting(setting: Setting): void {
    const m = t().settings;
    const store = this.plugin.tokenStore;
    const s = this.plugin.settings;

    setting.setName(m.tokenName);

    if (store.hasSecretStorage()) {
      // SecretComponent owns the secret *value*; we persist only its *name*
      // (`tokenSecretId`) and resolve the value at runtime via getSecret. Do NOT
      // treat the component's value as the raw token — its setValue/onChange
      // deal in the secret name, not the token.
      const desc = new DocumentFragment();
      desc.append(m.tokenIntro, m.tokenStorageSecret);
      setting.setDesc(desc);

      setting.addComponent((el) =>
        mountSecretName(this.app, el, s.tokenSecretId, (name) => {
          s.tokenSecretId = name;
          // No stale plaintext copy once a real secret is in use.
          store.setFallback(asTokenValue(""));
          void this.plugin.saveSettings();
        }),
      );
      return;
    }

    // No SecretStorage (Obsidian < 1.11.5, or no OS secret backend on Linux):
    // fall back to a masked plaintext value kept in the vault settings.
    const desc = new DocumentFragment();
    desc.append(m.tokenIntro, m.tokenStorageFallback);
    setting.setDesc(desc);

    setting.addText((text) => {
      text.inputEl.type = "password";
      text
        .setPlaceholder(m.tokenName)
        .setValue(store.get())
        .onChange((v) => {
          // Boundary: the user typed the raw token value.
          store.setFallback(asTokenValue(v.trim()));
        });
    });
  }

  private renderConnectionTest(setting: Setting): void {
    const m = t().settings;
    let statusEl!: HTMLElement;
    setting
      .setName(m.connectionName)
      .setDesc(m.connectionDesc)
      .addButton((b) =>
        b.setButtonText(m.testConnection).onClick(async () => {
          const client = this.plugin.getClient();
          if (!client) {
            this.setConnStatus(statusEl, false, m.setUrlAndTokenFirst);
            return;
          }
          b.setDisabled(true).setButtonText(m.testing);
          this.setConnStatus(statusEl, null, m.testing);
          const result = await client.checkConnection();
          b.setDisabled(false).setButtonText(m.testConnection);
          this.setConnStatus(statusEl, result.ok, result.message);
        }),
      );
    statusEl = setting.descEl.createDiv({ cls: "lw-conn-status" });
  }

  /** Update the inline connection-test result line. `ok === null` = in progress. */
  private setConnStatus(
    el: HTMLElement,
    ok: boolean | null,
    message: string,
  ): void {
    el.setText(message);
    el.toggleClass("is-ok", ok === true);
    el.toggleClass("is-error", ok === false);
  }

  private renderCollectionSetting(setting: Setting): void {
    const s = this.plugin.settings;
    const m = t().settings;
    let dropdown: DropdownComponent | undefined;

    const populate = (d: DropdownComponent): void => {
      d.selectEl.empty();
      d.addOption("", m.collectionUnorganized);
      const names = new Set<string>();
      for (const c of this.plugin.collections) {
        if (names.has(c.name)) continue;
        names.add(c.name);
        d.addOption(c.name, c.name);
      }
      // Keep the stored value selectable even when it isn't in the fetched list
      // (not yet refreshed, or a collection since renamed/removed).
      if (s.defaultCollection && !names.has(s.defaultCollection)) {
        d.addOption(s.defaultCollection, m.collectionNotInList(s.defaultCollection));
      }
      d.setValue(s.defaultCollection);
    };

    setting
      .setName(m.collectionName)
      .setDesc(m.collectionDesc)
      .addDropdown((d) => {
        dropdown = d;
        populate(d);
        d.onChange(async (v) => {
          s.defaultCollection = v;
          await this.plugin.saveSettings();
        });
      })
      .addExtraButton((b) =>
        b
          .setIcon("refresh-cw")
          .setTooltip(m.collectionReload)
          .onClick(() => void this.refreshCollections(dropdown, populate)),
      );

    // Load once per session so the dropdown isn't empty on first open; further
    // reloads are on-demand via the refresh button.
    if (this.plugin.collections.length === 0 && this.plugin.getClient()) {
      void this.refreshCollections(dropdown, populate);
    }
  }

  private async refreshCollections(
    dropdown: DropdownComponent | undefined,
    populate: (d: DropdownComponent) => void,
  ): Promise<void> {
    try {
      const result = await this.plugin.fetchCollections();
      if (result === null) {
        new Notice(t().settings.collectionSetUrlFirst);
        return;
      }
      if (dropdown) populate(dropdown);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(t().settings.collectionLoadFailed(msg));
    }
  }

  private renderColorMap(containerEl: HTMLElement): void {
    const m = t().settings;
    new Setting(containerEl).setName(m.colorMapHeading).setHeading();
    containerEl.createEl("p", {
      text: m.colorMapDesc,
      cls: "setting-item-description",
    });

    for (const color of Object.keys(this.plugin.settings.colorMap)) {
      this.renderColorRow(new Setting(containerEl), color);
    }
    this.renderAddColorRow(new Setting(containerEl));
  }

  private renderColorRow(setting: Setting, color: string): void {
    const m = t().settings;
    const map = this.plugin.settings.colorMap;
    const rule = map[color];
    setting
      .setName(color)
      .addText((text) =>
        text
          .setPlaceholder(m.colorCalloutPlaceholder)
          .setValue(rule.callout)
          .onChange(async (v) => {
            rule.callout = v.trim() || "quote";
            await this.plugin.saveSettings();
          }),
      )
      .addText((text) =>
        text
          .setPlaceholder(m.colorTagPlaceholder)
          .setValue(rule.tag ?? "")
          .onChange(async (v) => {
            const tag = v.trim().replace(/^#/, "");
            if (tag) rule.tag = tag;
            else delete rule.tag;
            await this.plugin.saveSettings();
          }),
      )
      .addExtraButton((b) =>
        b
          .setIcon("trash")
          .setTooltip(m.colorRemove)
          .onClick(async () => {
            delete map[color];
            await this.plugin.saveSettings();
            this.rerender();
          }),
      );
  }

  private renderAddColorRow(setting: Setting): void {
    const m = t().settings;
    const map = this.plugin.settings.colorMap;
    let newColor = "";
    setting
      .setName(m.addColor)
      .addText((text) =>
        text.setPlaceholder(m.addColorPlaceholder).onChange((v) => {
          newColor = v.trim().toLowerCase();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText(m.add)
          .setCta()
          .onClick(async () => {
            if (!newColor || map[newColor]) return;
            map[newColor] = { callout: "quote" };
            await this.plugin.saveSettings();
            this.rerender();
          }),
      );
  }
}
