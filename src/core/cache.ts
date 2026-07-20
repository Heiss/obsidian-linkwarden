// A pure, serializable TTL cache mapping `linkId` → cached highlights plus the
// epoch-ms timestamp they were fetched. Kept free of Obsidian imports so it can
// be unit-tested and persisted straight into `data.json`.

import type { Highlight } from "../api/models";

export interface CacheEntry {
  highlights: Highlight[];
  /** Epoch milliseconds at which the highlights were fetched. */
  fetchedAt: number;
}

/** Serialized form persisted in `data.json`. */
export type CacheData = Record<number, CacheEntry>;

export class HighlightCache {
  private ttlMs: number;
  private readonly entries: Map<number, CacheEntry>;
  private readonly now: () => number;

  constructor(ttlMinutes: number, data?: CacheData, now: () => number = Date.now) {
    this.ttlMs = ttlMinutes * 60_000;
    this.now = now;
    this.entries = new Map();
    if (data) {
      for (const key of Object.keys(data)) {
        const linkId = Number(key);
        const entry = data[linkId];
        this.entries.set(linkId, {
          highlights: entry.highlights,
          fetchedAt: entry.fetchedAt,
        });
      }
    }
  }

  setTtlMinutes(ttlMinutes: number): void {
    this.ttlMs = ttlMinutes * 60_000;
  }

  /** Store highlights for a link, stamping `fetchedAt` with `now()`. */
  set(linkId: number, highlights: Highlight[]): void {
    this.entries.set(linkId, { highlights, fetchedAt: this.now() });
  }

  /** Return the entry if present, regardless of freshness (offline use). */
  getEntry(linkId: number): CacheEntry | undefined {
    return this.entries.get(linkId);
  }

  /** Return highlights only if present AND fresh (age <= ttl), else undefined. */
  getFresh(linkId: number): Highlight[] | undefined {
    return this.isFresh(linkId) ? this.entries.get(linkId)!.highlights : undefined;
  }

  /** True if there is an entry and it is within ttl. */
  isFresh(linkId: number): boolean {
    if (this.ttlMs <= 0) return false;
    const age = this.ageMs(linkId);
    return age !== undefined && age <= this.ttlMs;
  }

  /** Age of the entry in ms, or undefined if absent. */
  ageMs(linkId: number): number | undefined {
    const entry = this.entries.get(linkId);
    return entry ? this.now() - entry.fetchedAt : undefined;
  }

  invalidate(linkId: number): void {
    this.entries.delete(linkId);
  }

  clear(): void {
    this.entries.clear();
  }

  /** Serializable snapshot for persistence. */
  toJSON(): CacheData {
    const out: CacheData = {};
    for (const [linkId, entry] of this.entries) {
      out[linkId] = { highlights: entry.highlights, fetchedAt: entry.fetchedAt };
    }
    return out;
  }
}
