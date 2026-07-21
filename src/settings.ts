// Plugin settings shape and defaults. Sensitive values (the access token) are
// NOT stored here — the token lives in SecretStorage under a fixed id (see D6).
// Kept obsidian-free so the defaults/merge logic is unit-testable.

import type { DeepLinkTarget } from "./core/urls";
import { DEFAULT_COLOR_MAP, type ColorMap } from "./core/colorMap";

export interface LinkwardenSettings {
  /** Instance base URL — used for API calls *and* as the host of deep links. */
  baseUrl: string;
  /** Plaintext token fallback for Obsidian < 1.11.5 (empty when SecretStorage). */
  tokenFallback: string;
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
  baseUrl: "",
  tokenFallback: "",
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
