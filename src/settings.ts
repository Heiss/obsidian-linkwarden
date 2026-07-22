// Plugin settings shape and defaults. The access-token *value* is NOT stored
// here — it lives in Obsidian's SecretStorage (see D6). Settings hold only the
// secret's *name* (`tokenSecretId`, what `SecretComponent` manages), plus a
// plaintext fallback for Obsidian versions without SecretStorage.
// Kept obsidian-free so the defaults/merge logic is unit-testable.

import type { DeepLinkTarget } from "./core/urls";
import {
  EMPTY_TOKEN,
  TOKEN_SECRET_ID,
  type SecretName,
  type TokenValue,
} from "./core/secretId";
import { DEFAULT_COLOR_MAP, type ColorMap } from "./core/colorMap";

export interface LinkwardenSettings {
  /** Instance base URL — used for API calls *and* as the host of deep links. */
  baseUrl: string;
  /**
   * Name of the SecretStorage secret holding the access token. This is what
   * `SecretComponent` reads/writes (the component owns the value; we only keep
   * the name). The token value is fetched at runtime via `getSecret(name)`.
   */
  tokenSecretId: SecretName;
  /** Plaintext token fallback for Obsidian < 1.11.5 (empty when SecretStorage). */
  tokenFallback: TokenValue;
  /** Where binding deep links point. */
  deepLinkTarget: DeepLinkTarget;
  /** Default target collection name for the F3 export (empty → Unorganized). */
  defaultCollection: string;
  /** color → callout/tag mapping for the F4 insert action. */
  colorMap: ColorMap;
  /** Highlight cache time-to-live, in minutes. */
  cacheTtlMinutes: number;
}

export const DEFAULT_SETTINGS: LinkwardenSettings = {
  // Official Linkwarden Cloud; self-hosters overwrite this with their instance.
  baseUrl: "https://cloud.linkwarden.app",
  tokenSecretId: TOKEN_SECRET_ID,
  tokenFallback: EMPTY_TOKEN,
  deepLinkTarget: "links",
  defaultCollection: "",
  colorMap: DEFAULT_COLOR_MAP,
  cacheTtlMinutes: 60,
};

/** Merge persisted (possibly partial/legacy) data over the defaults. */
export function mergeSettings(
  data: Partial<LinkwardenSettings> | null | undefined,
): LinkwardenSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(data ?? {}),
    // Nested map must be merged, not replaced wholesale, so new default keys
    // survive an upgrade.
    colorMap: { ...DEFAULT_COLOR_MAP, ...(data?.colorMap ?? {}) },
  };
}
