import { Notice } from "obsidian";
import type LinkwardenPlugin from "../main";
import type { LinkwardenClient } from "../api/client";
import type { CreateLinkBody, Link } from "../api/models";
import { t } from "../i18n";

/**
 * Archive a URL to Linkwarden and resolve to its link (D5): a normal create, or
 * — when the server reports a duplicate — a search to find the existing link.
 * Returns null on failure (a Notice is shown).
 */
export async function resolveArchive(
  plugin: LinkwardenPlugin,
  client: LinkwardenClient,
  url: string,
): Promise<Link | null> {
  const body: CreateLinkBody = { url };
  const collection = plugin.settings.defaultCollection.trim();
  if (collection) body.collection = { name: collection };

  try {
    const res = await client.createLink(body);
    if (res.link) return res.link;
    if (res.alreadyExists) {
      const matches = await client.search(url);
      const exact = matches.find((m) => m.url === url) ?? matches[0];
      if (exact) return exact;
      new Notice(t().archive.existsButNotLocated);
      return null;
    }
    new Notice(t().archive.unexpectedResponse);
    return null;
  } catch (e) {
    new Notice(t().archive.failed(errorText(e)));
    return null;
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
