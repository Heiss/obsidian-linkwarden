// Pure helpers for translating between Linkwarden link ids and the deep-link
// URLs the plugin embeds in notes. No Obsidian dependency → fully unit-tested.

/** Where a binding deep link should point. */
export type DeepLinkTarget = "links" | "preserved" | "public/links";

/** All path prefixes a binding href may use (for parsing back to an id). */
const BINDING_PREFIXES = ["public/links", "links", "preserved"] as const;

/** Remove trailing slashes and surrounding whitespace from a base URL. */
export function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, "");
}

/** Build a deep link like `<base>/links/<id>` for a given id and target. */
export function buildDeepLink(
  base: string,
  id: number,
  target: DeepLinkTarget,
): string {
  return `${normalizeBase(base)}/${target}/${id}`;
}

/**
 * Extract the Linkwarden link id from a binding href, or `null` if the href is
 * not a binding on this instance. Matches `/links/<id>`, `/preserved/<id>` and
 * `/public/links/<id>`; tolerant of trailing slashes, query strings and
 * fragments.
 */
export function parseBindingId(href: string, base: string): number | null {
  const normalizedBase = normalizeBase(base);
  let hostPath: string;
  let basePath: string;
  try {
    const url = new URL(href);
    const baseUrl = new URL(normalizedBase);
    if (url.host !== baseUrl.host || url.protocol !== baseUrl.protocol) {
      return null;
    }
    hostPath = url.pathname;
    basePath = baseUrl.pathname;
  } catch {
    return null;
  }

  // Strip the base's own path prefix (instances can live under a subpath).
  let path = hostPath;
  if (basePath !== "/" && path.startsWith(basePath)) {
    path = path.slice(basePath.length);
  }
  path = path.replace(/^\/+/, "").replace(/\/+$/, "");

  for (const prefix of BINDING_PREFIXES) {
    if (path.startsWith(`${prefix}/`)) {
      const rest = path.slice(prefix.length + 1);
      if (/^\d+$/.test(rest)) {
        return Number(rest);
      }
    }
  }
  return null;
}
