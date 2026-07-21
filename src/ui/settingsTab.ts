import {
  App,
  DropdownComponent,
  Notice,
  PluginSettingTab,
  SecretComponent,
  Setting,
  type SettingDefinitionItem,
} from "obsidian";
import type LinkwardenPlugin from "../main";
import type { DeepLinkTarget } from "../core/urls";

export class LinkwardenSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: LinkwardenPlugin,
  ) {
    super(app, plugin);
  }

  // Declarative settings (Obsidian ≥ 1.13). Simple values are `control`s so they
  // surface in the settings search; the custom surfaces (token, connection test,
  // collection picker, color map) use the `render` escape hatch. There is no
  // `display()` fallback — the plugin's minAppVersion is 1.13.0.
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

  // Read the value backing a declarative `control`. Only the keys used above are
  // handled; everything else lives behind a custom `render`.
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
            // Structural change — rebuild the declarative tab so the row is gone.
            this.update();
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
            // Structural change — rebuild the declarative tab to show the new row.
            this.update();
          }),
      );
  }
}
