// Access-token storage (D6). Prefers Obsidian's SecretStorage (device-local,
// OS-backed, does not enter the synced vault). Falls back to a plaintext value
// in settings for Obsidian < 1.11.5 where SecretStorage is unavailable.

import type { App } from "obsidian";
import { isValidSecretId } from "../core/secretId";

export interface TokenStore {
  /** Whether the OS-backed SecretStorage is available on this device. */
  hasSecretStorage(): boolean;
  /** Read the token, or "" if none. */
  get(): string;
  /** Persist the token. Returns true if it went to SecretStorage. */
  set(token: string): boolean;
}

export function createTokenStore(
  app: App,
  secretId: string,
  fallback: { get(): string; set(value: string): void },
): TokenStore {
  const secretStorage = (app as App & { secretStorage?: unknown })
    .secretStorage as
    | {
        getSecret(id: string): string | null;
        setSecret(id: string, value: string): void;
      }
    | undefined;

  const available =
    !!secretStorage &&
    typeof secretStorage.getSecret === "function" &&
    isValidSecretId(secretId);

  return {
    hasSecretStorage: () => available,
    get(): string {
      if (available) {
        try {
          const v = secretStorage!.getSecret(secretId);
          if (v) return v;
        } catch {
          // fall through to the plaintext fallback
        }
      }
      // Fallback covers Obsidian < 1.11.5 and a not-yet-populated secret
      // (e.g. the preconfigured demo vault).
      return fallback.get();
    },
    set(token: string): boolean {
      if (available) {
        secretStorage!.setSecret(secretId, token);
        // Ensure no plaintext copy lingers in the synced settings.
        fallback.set("");
        return true;
      }
      fallback.set(token);
      return false;
    },
  };
}
