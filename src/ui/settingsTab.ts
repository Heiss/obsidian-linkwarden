import { App, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type LinkwardenPlugin from "../main";
import { normalizeSecretId } from "../core/secretId";
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

    new Setting(containerEl)
      .setName("Default collection")
      .setDesc("Target collection for exports. Empty → Linkwarden's \"Unorganized\".")
      .addText((t) =>
        t
          .setPlaceholder("Reading")
          .setValue(s.defaultCollection)
          .onChange(async (v) => {
            s.defaultCollection = v.trim();
            await this.plugin.saveSettings();
          }),
      );

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
    const desc = store.hasSecretStorage()
      ? "Stored in Obsidian's device-local SecretStorage — never enters the synced vault. Enter once per device."
      : "SecretStorage unavailable (needs Obsidian ≥ 1.11.5, Linux needs kwallet/libsecret). Falls back to storing in the vault settings.";

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

    // Secret id used in SecretStorage — advanced, kept valid automatically.
    new Setting(containerEl)
      .setName("Secret id")
      .setDesc("Identifier under which the token is stored (advanced; [a-z0-9-]).")
      .addText((t) =>
        t.setValue(this.plugin.settings.tokenSecretId).onChange(async (v) => {
          this.plugin.settings.tokenSecretId = normalizeSecretId(v);
          await this.plugin.saveSettings();
        }),
      );
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
            .setPlaceholder("callout (e.g. quote)")
            .setValue(rule.callout)
            .onChange(async (v) => {
              rule.callout = v.trim() || "quote";
              await this.plugin.saveSettings();
            }),
        )
        .addText((t) =>
          t
            .setPlaceholder("tag (optional)")
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
        t.setPlaceholder("color value from Linkwarden").onChange((v) => {
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
