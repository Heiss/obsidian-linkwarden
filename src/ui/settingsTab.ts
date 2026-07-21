import {
  App,
  DropdownComponent,
  Notice,
  PluginSettingTab,
  SecretComponent,
  Setting,
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

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;

    new Setting(containerEl)
      .setName("Instance base URL")
      .setDesc("Your Linkwarden URL, used for API calls and binding deep links.")
      .addText((t) =>
        t
          .setPlaceholder("https://links.example.tld")
          .setValue(s.baseUrl)
          .onChange(async (v) => {
            s.baseUrl = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    this.renderTokenSetting(containerEl);

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

    this.renderCollectionSetting(containerEl);

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

  private renderTokenSetting(containerEl: HTMLElement): void {
    const store = this.plugin.tokenStore;
    const storage = store.hasSecretStorage()
      ? "Stored in Obsidian's device-local SecretStorage — never enters the synced vault. Enter once per device."
      : "SecretStorage unavailable (needs Obsidian ≥ 1.11.5, Linux needs kwallet/libsecret). Falls back to storing in the vault settings.";

    const desc = new DocumentFragment();
    desc.append(
      "Generate one in Linkwarden under Settings → Access Tokens → Create Access Token, then paste it here. ",
      storage,
    );

    const setting = new Setting(containerEl)
      .setName("Access token")
      .setDesc(desc);

    setting.addComponent((el) => {
      const c = new SecretComponent(this.app, el);
      c.setValue(store.get());
      c.onChange((v) => {
        store.set(v.trim());
      });
      return c;
    });
  }

  private renderCollectionSetting(containerEl: HTMLElement): void {
    const s = this.plugin.settings;
    let dropdown: DropdownComponent | undefined;

    const populate = (d: DropdownComponent): void => {
      d.selectEl.empty();
      d.addOption("", 'Unorganized (Linkwarden default)');
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

    new Setting(containerEl)
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

    const map = this.plugin.settings.colorMap;
    for (const color of Object.keys(map)) {
      const rule = map[color];
      new Setting(containerEl)
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
              this.display();
            }),
        );
    }

    let newColor = "";
    new Setting(containerEl)
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
            this.display();
          }),
      );
  }
}
