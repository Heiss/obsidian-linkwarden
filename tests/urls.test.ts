import { describe, it, expect } from "vitest";
import {
  normalizeBase,
  buildDeepLink,
  parseBindingId,
  type DeepLinkTarget,
} from "../src/core/urls";

describe("normalizeBase", () => {
  it("strips a single trailing slash", () => {
    expect(normalizeBase("https://links.example.tld/")).toBe(
      "https://links.example.tld",
    );
  });

  it("strips multiple trailing slashes", () => {
    expect(normalizeBase("https://links.example.tld///")).toBe(
      "https://links.example.tld",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeBase("  https://links.example.tld ")).toBe(
      "https://links.example.tld",
    );
  });

  it("leaves a clean base untouched", () => {
    expect(normalizeBase("https://links.example.tld")).toBe(
      "https://links.example.tld",
    );
  });
});

describe("buildDeepLink", () => {
  it("builds a /links target by default", () => {
    expect(buildDeepLink("https://links.example.tld", 842, "links")).toBe(
      "https://links.example.tld/links/842",
    );
  });

  it("builds a /preserved target", () => {
    expect(buildDeepLink("https://links.example.tld", 842, "preserved")).toBe(
      "https://links.example.tld/preserved/842",
    );
  });

  it("builds a public target", () => {
    expect(
      buildDeepLink("https://links.example.tld", 842, "public/links"),
    ).toBe("https://links.example.tld/public/links/842");
  });

  it("normalizes a base with a trailing slash", () => {
    expect(buildDeepLink("https://links.example.tld/", 1, "links")).toBe(
      "https://links.example.tld/links/1",
    );
  });
});

describe("parseBindingId", () => {
  const base = "https://links.example.tld";

  it("parses a /links deep link", () => {
    expect(parseBindingId("https://links.example.tld/links/842", base)).toBe(
      842,
    );
  });

  it("parses a /preserved deep link", () => {
    expect(
      parseBindingId("https://links.example.tld/preserved/12", base),
    ).toBe(12);
  });

  it("parses a /public/links deep link", () => {
    expect(
      parseBindingId("https://links.example.tld/public/links/7", base),
    ).toBe(7);
  });

  it("tolerates a trailing slash on the href", () => {
    expect(parseBindingId("https://links.example.tld/links/842/", base)).toBe(
      842,
    );
  });

  it("ignores query strings and fragments", () => {
    expect(
      parseBindingId("https://links.example.tld/links/842?foo=1#x", base),
    ).toBe(842);
  });

  it("returns null for a different host", () => {
    expect(parseBindingId("https://other.tld/links/842", base)).toBeNull();
  });

  it("returns null for a non-binding path on the same host", () => {
    expect(
      parseBindingId("https://links.example.tld/dashboard", base),
    ).toBeNull();
  });

  it("returns null for a non-numeric id", () => {
    expect(
      parseBindingId("https://links.example.tld/links/abc", base),
    ).toBeNull();
  });

  it("normalizes the base before comparing", () => {
    expect(
      parseBindingId(
        "https://links.example.tld/links/842",
        "https://links.example.tld/",
      ),
    ).toBe(842);
  });
});

// Ensure the exported type is usable.
const _target: DeepLinkTarget = "links";
void _target;
