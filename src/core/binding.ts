// Pure helpers for producing the Markdown binding link (F1/F3). The link text is
// a human-readable fallback; the href carries the id (single source of truth).

import type { Link } from "../api/models";

/** Choose a readable label for a link: its name, else its url, else `#<id>`. */
export function linkLabel(link: Pick<Link, "id" | "name" | "url">): string {
  const name = link.name?.trim();
  if (name) return name;
  const url = link.url?.trim();
  if (url) return url;
  return `#${link.id}`;
}

/** Escape a label so it is safe inside `[...]` of a Markdown link. */
export function escapeLabel(label: string): string {
  return label.replace(/[[\]]/g, "\\$&").replace(/\r?\n/g, " ").trim();
}

/** Build the Markdown binding link `[label](href)`. */
export function formatBindingLink(label: string, href: string): string {
  return `[${escapeLabel(label)}](${href})`;
}
