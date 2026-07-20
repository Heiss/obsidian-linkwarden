import { describe, it, expect } from "vitest";
import type { Highlight } from "../src/api/models";
import { HighlightCache, type CacheData } from "../src/core/cache";

function hl(id: number, linkId: number): Highlight {
  return {
    id,
    text: `highlight ${id}`,
    color: "yellow",
    startOffset: 0,
    endOffset: 10,
    linkId,
  } as Highlight;
}

/** Mutable clock helper for controlling time in tests. */
function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
  };
}

const MIN = 60_000;

describe("HighlightCache", () => {
  it("set then getFresh returns the stored highlights", () => {
    const c = clock();
    const cache = new HighlightCache(10, undefined, c.now);
    const data = [hl(1, 42), hl(2, 42)];
    cache.set(42, data);
    expect(cache.getFresh(42)).toEqual(data);
    expect(cache.isFresh(42)).toBe(true);
  });

  it("returns undefined for an absent link", () => {
    const cache = new HighlightCache(10, undefined, clock().now);
    expect(cache.getFresh(99)).toBeUndefined();
    expect(cache.getEntry(99)).toBeUndefined();
    expect(cache.isFresh(99)).toBe(false);
    expect(cache.ageMs(99)).toBeUndefined();
  });

  it("stamps fetchedAt with the injected now()", () => {
    const c = clock(500);
    const cache = new HighlightCache(10, undefined, c.now);
    cache.set(1, [hl(1, 1)]);
    expect(cache.getEntry(1)?.fetchedAt).toBe(500);
  });

  it("after advancing beyond ttl, getFresh is undefined but getEntry still returns it", () => {
    const c = clock();
    const cache = new HighlightCache(10, undefined, c.now);
    const data = [hl(1, 7)];
    cache.set(7, data);
    c.advance(10 * MIN + 1);
    expect(cache.getFresh(7)).toBeUndefined();
    expect(cache.isFresh(7)).toBe(false);
    expect(cache.getEntry(7)?.highlights).toEqual(data);
  });

  it("treats an entry exactly at the ttl boundary as fresh", () => {
    const c = clock();
    const cache = new HighlightCache(10, undefined, c.now);
    cache.set(1, [hl(1, 1)]);
    c.advance(10 * MIN); // age === ttl
    expect(cache.isFresh(1)).toBe(true);
    expect(cache.getFresh(1)).toBeDefined();
    c.advance(1); // age === ttl + 1ms
    expect(cache.isFresh(1)).toBe(false);
    expect(cache.getFresh(1)).toBeUndefined();
  });

  it("never counts as fresh when ttl <= 0", () => {
    const c = clock();
    const cache = new HighlightCache(0, undefined, c.now);
    cache.set(1, [hl(1, 1)]);
    expect(cache.isFresh(1)).toBe(false);
    expect(cache.getFresh(1)).toBeUndefined();
    // but the entry is still retrievable for offline use
    expect(cache.getEntry(1)).toBeDefined();

    const cacheNeg = new HighlightCache(-5, undefined, c.now);
    cacheNeg.set(1, [hl(1, 1)]);
    expect(cacheNeg.isFresh(1)).toBe(false);
    expect(cacheNeg.getFresh(1)).toBeUndefined();
  });

  it("setTtlMinutes changes freshness evaluation", () => {
    const c = clock();
    const cache = new HighlightCache(10, undefined, c.now);
    cache.set(1, [hl(1, 1)]);
    c.advance(15 * MIN);
    expect(cache.isFresh(1)).toBe(false);
    cache.setTtlMinutes(20);
    expect(cache.isFresh(1)).toBe(true);
    cache.setTtlMinutes(0);
    expect(cache.isFresh(1)).toBe(false);
  });

  it("reports ageMs using the injected clock", () => {
    const c = clock();
    const cache = new HighlightCache(10, undefined, c.now);
    cache.set(1, [hl(1, 1)]);
    expect(cache.ageMs(1)).toBe(0);
    c.advance(1234);
    expect(cache.ageMs(1)).toBe(1234);
  });

  it("invalidate removes a single entry", () => {
    const cache = new HighlightCache(10, undefined, clock().now);
    cache.set(1, [hl(1, 1)]);
    cache.set(2, [hl(2, 2)]);
    cache.invalidate(1);
    expect(cache.getEntry(1)).toBeUndefined();
    expect(cache.getEntry(2)).toBeDefined();
  });

  it("clear removes all entries", () => {
    const cache = new HighlightCache(10, undefined, clock().now);
    cache.set(1, [hl(1, 1)]);
    cache.set(2, [hl(2, 2)]);
    cache.clear();
    expect(cache.getEntry(1)).toBeUndefined();
    expect(cache.getEntry(2)).toBeUndefined();
    expect(cache.toJSON()).toEqual({});
  });

  it("toJSON round-trips through the constructor's data arg", () => {
    const c = clock(2_000);
    const cache = new HighlightCache(10, undefined, c.now);
    cache.set(42, [hl(1, 42)]);
    cache.set(7, [hl(2, 7), hl(3, 7)]);
    const snapshot: CacheData = cache.toJSON();

    // rebuild from serialized data at the same clock time
    const restored = new HighlightCache(10, snapshot, c.now);
    expect(restored.toJSON()).toEqual(snapshot);
    expect(restored.getEntry(42)?.fetchedAt).toBe(2_000);
    expect(restored.getFresh(42)).toEqual([hl(1, 42)]);
    expect(restored.getEntry(7)?.highlights).toHaveLength(2);
  });

  it("toJSON is a serializable snapshot detached from internal state", () => {
    const cache = new HighlightCache(10, undefined, clock().now);
    cache.set(1, [hl(1, 1)]);
    const snap = cache.toJSON();
    // JSON round-trip must preserve the shape
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });
});
