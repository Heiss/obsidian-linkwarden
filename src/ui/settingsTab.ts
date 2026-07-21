import {
  App,
  DropdownComponent,
  Notice,
  PluginSettingTab,
  requireApiVersion,
  SecretComponent,
  Setting,
  type SettingDefinitionItem,
} from "obsidian";
import type LinkwardenPlugin from "../main";
import type { DeepLinkTarget } from "../core/urls";

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
    return [
      {
        name: "Instance base URL",
        desc:
          "Your Linkwarden URL, used for API calls and binding deep links. " +
          "Defaults to Linkwarden Cloud; change it if you self-host.",
        control: {
          type: "text",
          key: "baseUrl",
          placeholder: "https://cloud.linkwarden.app",
        },
      },
      {
        name: "Access token",
        desc: "Access token used to reach your Linkwarden instance.",
        render: (setting) => this.renderTokenSetting(setting),
      },
      {
        name: "Connection",
        desc: "Check that the base URL and access token can reach your Linkwarden instance.",
        render: (setting) => this.renderConnectionTest(setting),
      },
      {
        name: "Deep-link target",
        desc: "Where binding links point. Public collections can be shared without login.",
        control: {
          type: "dropdown",
          key: "deepLinkTarget",
          options: {
            links: "/links (detail page)",
            preserved: "/preserved (reader)",
            "public/links": "/public/links (no login)",
          },
        },
      },
      {
        name: "Default collection",
        desc: 'Target collection for exports. "Unorganized" is Linkwarden\'s default.',
        render: (setting) => this.renderCollectionSetting(setting),
      },
      {
        name: "Highlight cache TTL (minutes)",
        desc: "How long cached highlights stay fresh before a refetch. 0 = always refetch.",
        control: {
          type: "number",
          key: "cacheTtlMinutes",
          placeholder: "60",
          min: 0,
        },
      },
      {
        type: "group",
        heading: "Color mapping",
        items: [
          {
            name: "About color mapping",
            searchable: false,
            render: (setting) => {
              setting
                .setName("")
                .setDesc(
                  "Map each Linkwarden highlight color to a callout type and an optional tag for the insert action.",
                );
            },
          },
          ...Object.keys(this.plugin.settings.colorMap).map((color) => ({
            name: color,
            render: (setting: Setting) => this.renderColorRow(setting, color),
          })),
          {
            name: "Add a color",
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

    new Setting(containerEl)
      .setName("Instance base URL")
      .setDesc(
        "Your Linkwarden URL, used for API calls and binding deep links. " +
          "Defaults to Linkwarden Cloud; change it if you self-host.",
      )
      .addText((t) =>
        t
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
      .setName("Deep-link target")
      .setDesc("Where binding links point. Public collections can be shared without login.")
      .addDropdown((d) =>
        d
          .addOption("links", "/links (detail page)")
          .addOption("preserved", "/preserved (reader)")
          .addOption("public/links", "/public/links (no login)")
          .setValue(s.deepLinkTarget)
          .onChange(async (v) => {
            s.deepLinkTarget = v as DeepLinkTarget;
            await this.plugin.saveSettings();
          }),
      );

    this.renderCollectionSetting(new Setting(containerEl));

    new Setting(containerEl)
      .setName("Highlight cache TTL (minutes)")
      .setDesc("How long cached highlights stay fresh before a refetch. 0 = always refetch.")
      .addText((t) =>
        t
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
    const store = this.plugin.tokenStore;
    const storage = store.hasSecretStorage()
      ? "Stored in Obsidian's device-local SecretStorage — never enters the synced vault. Enter once per device."
      : "SecretStorage unavailable (needs Obsidian ≥ 1.11.5, Linux needs kwallet/libsecret). Falls back to storing in the vault settings.";

    const desc = new DocumentFragment();
    desc.append(
      "Generate one in Linkwarden under Settings → Access Tokens → Create Access Token, then paste it here. ",
      storage,
    );

    setting.setName("Access token").setDesc(desc);

    setting.addComponent((el) => {
      const c = new SecretComponent(this.app, el);
      c.setValue(store.get());
      c.onChange((v) => {
        store.set(v.trim());
      });
      return c;
    });
  }

  private renderConnectionTest(setting: Setting): void {
    let statusEl!: HTMLElement;
    setting
      .setName("Connection")
      .setDesc(
        "Check that the base URL and access token can reach your Linkwarden instance.",
      )
      .addButton((b) =>
        b.setButtonText("Test connection").onClick(async () => {
          const client = this.plugin.getClient();
          if (!client) {
            this.setConnStatus(statusEl, false, "Set the base URL and access token first.");
            return;
          }
          b.setDisabled(true).setButtonText("Testing…");
          this.setConnStatus(statusEl, null, "Testing…");
          const result = await client.checkConnection();
          b.setDisabled(false).setButtonText("Test connection");
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
    let dropdown: DropdownComponent | undefined;

    const populate = (d: DropdownComponent): void => {
      d.selectEl.empty();
      d.addOption("", "Unorganized (Linkwarden default)");
      const names = new Set<string>();
      for (const c of this.plugin.collections) {
        if (names.has(c.name)) continue;
        names.add(c.name);
        d.addOption(c.name, c.name);
      }
      // Keep the stored value selectable even when it isn't in the fetched list
      // (not yet refreshed, or a collection since renamed/removed).
      if (s.defaultCollection && !names.has(s.defaultCollection)) {
        d.addOption(s.defaultCollection, `${s.defaultCollection} (not in list)`);
      }
      d.setValue(s.defaultCollection);
    };

    setting
      .setName("Default collection")
      .setDesc('Target collection for exports. "Unorganized" is Linkwarden\'s default.')
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
          .setTooltip("Reload collections from Linkwarden")
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
        new Notice("Linkwarden: set the instance URL and access token first.");
        return;
      }
      if (dropdown) populate(dropdown);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Linkwarden: could not load collections — ${msg}`);
    }
  }

  private renderColorMap(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Color mapping").setHeading();
    containerEl.createEl("p", {
      text: "Map each Linkwarden highlight color to a callout type and an optional tag for the insert action.",
      cls: "setting-item-description",
    });

    for (const color of Object.keys(this.plugin.settings.colorMap)) {
      this.renderColorRow(new Setting(containerEl), color);
    }
    this.renderAddColorRow(new Setting(containerEl));
  }

  private renderColorRow(setting: Setting, color: string): void {
    const map = this.plugin.settings.colorMap;
    const rule = map[color];
    setting
      .setName(color)
      .addText((t) =>
        t
          .setPlaceholder("Callout type (quote)")
          .setValue(rule.callout)
          .onChange(async (v) => {
            rule.callout = v.trim() || "quote";
            await this.plugin.saveSettings();
          }),
      )
      .addText((t) =>
        t
          .setPlaceholder("Tag (optional)")
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
          .setTooltip("Remove")
          .onClick(async () => {
            delete map[color];
            await this.plugin.saveSettings();
            this.rerender();
          }),
      );
  }

  private renderAddColorRow(setting: Setting): void {
    const map = this.plugin.settings.colorMap;
    let newColor = "";
    setting
      .setName("Add a color")
      .addText((t) =>
        t.setPlaceholder("Color value from Linkwarden").onChange((v) => {
          newColor = v.trim().toLowerCase();
        }),
      )
      .addButton((b) =>
        b
          .setButtonText("Add")
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
