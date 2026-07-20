// Secret ids used with Obsidian's SecretStorage must match `[a-z0-9-]+` (D6).
// These helpers validate and normalize arbitrary strings into that shape.

const VALID_SECRET_ID = /^[a-z0-9-]+$/;

/** True iff `id` is non-empty and consists only of `a-z`, `0-9` and `-`. */
export function isValidSecretId(id: string): boolean {
  return VALID_SECRET_ID.test(id);
}

/**
 * Normalize an arbitrary string into a valid secret id:
 * lowercase, spaces/underscores → `-`, drop any other invalid chars,
 * collapse repeated `-`, trim leading/trailing `-`.
 * If nothing usable remains, fall back to `"linkwarden-token"`.
 */
export function normalizeSecretId(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[\s_]+/g, "-") // spaces & underscores become separators
    .replace(/[^a-z0-9-]+/g, "") // drop anything still invalid
    .replace(/-+/g, "-") // collapse repeated separators
    .replace(/^-+|-+$/g, ""); // trim leading/trailing separators

  return normalized.length > 0 ? normalized : "linkwarden-token";
}
