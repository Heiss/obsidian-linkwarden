import { describe, it, expect } from "vitest";
import { isValidSecretId, normalizeSecretId } from "../src/core/secretId";

describe("isValidSecretId", () => {
  it("accepts lowercase letters, digits and hyphens", () => {
    expect(isValidSecretId("linkwarden-token")).toBe(true);
    expect(isValidSecretId("abc123")).toBe(true);
    expect(isValidSecretId("a-b-c")).toBe(true);
    expect(isValidSecretId("---")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidSecretId("")).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(isValidSecretId("Linkwarden")).toBe(false);
  });

  it("rejects spaces, underscores and other punctuation", () => {
    expect(isValidSecretId("a b")).toBe(false);
    expect(isValidSecretId("a_b")).toBe(false);
    expect(isValidSecretId("a.b")).toBe(false);
    expect(isValidSecretId("a*b")).toBe(false);
  });
});

describe("normalizeSecretId", () => {
  it("lowercases and turns spaces into hyphens", () => {
    expect(normalizeSecretId("Linkwarden Token")).toBe("linkwarden-token");
  });

  it("falls back to linkwarden-token when nothing remains", () => {
    expect(normalizeSecretId("  ***  ")).toBe("linkwarden-token");
    expect(normalizeSecretId("")).toBe("linkwarden-token");
  });

  it("passes an already-valid id through unchanged", () => {
    expect(normalizeSecretId("linkwarden-token")).toBe("linkwarden-token");
    expect(normalizeSecretId("abc123")).toBe("abc123");
  });

  it("collapses repeated separators and drops invalid chars", () => {
    expect(normalizeSecretId("a__b  c")).toBe("a-b-c");
  });

  it("converts underscores to hyphens", () => {
    expect(normalizeSecretId("my_token")).toBe("my-token");
  });

  it("trims leading and trailing hyphens", () => {
    expect(normalizeSecretId("--hello--")).toBe("hello");
    expect(normalizeSecretId("  spaced  ")).toBe("spaced");
  });

  it("produces a result that is itself a valid secret id", () => {
    for (const input of ["Weird!! Name??", "___", "MixedCase_123", "  "]) {
      expect(isValidSecretId(normalizeSecretId(input))).toBe(true);
    }
  });
});
