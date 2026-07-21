// The access token is stored in Obsidian's SecretStorage under this fixed id.
// Secret ids must match `[a-z0-9-]+` (D6); this constant does.

/** SecretStorage id under which the Linkwarden access token is stored. */
export const TOKEN_SECRET_ID = "linkwarden-token";

const VALID_SECRET_ID = /^[a-z0-9-]+$/;

/** True iff `id` is non-empty and consists only of `a-z`, `0-9` and `-`. */
export function isValidSecretId(id: string): boolean {
  return VALID_SECRET_ID.test(id);
}
