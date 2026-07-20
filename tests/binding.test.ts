import { describe, it, expect } from "vitest";
import { linkLabel, escapeLabel, formatBindingLink } from "../src/core/binding";

describe("linkLabel", () => {
  it("prefers the name", () => {
    expect(linkLabel({ id: 1, name: "On RAG", url: "https://x.tld" })).toBe(
      "On RAG",
    );
  });
  it("falls back to the url", () => {
    expect(linkLabel({ id: 1, name: "  ", url: "https://x.tld" })).toBe(
      "https://x.tld",
    );
  });
  it("falls back to the id", () => {
    expect(linkLabel({ id: 42, name: null, url: null })).toBe("#42");
  });
});

describe("escapeLabel", () => {
  it("escapes brackets", () => {
    expect(escapeLabel("a [b] c")).toBe("a \\[b\\] c");
  });
  it("flattens newlines", () => {
    expect(escapeLabel("a\nb")).toBe("a b");
  });
});

describe("formatBindingLink", () => {
  it("builds a markdown link", () => {
    expect(
      formatBindingLink("On RAG", "https://links.example.tld/links/842"),
    ).toBe("[On RAG](https://links.example.tld/links/842)");
  });
  it("escapes the label", () => {
    expect(formatBindingLink("a [x]", "https://h/links/1")).toBe(
      "[a \\[x\\]](https://h/links/1)",
    );
  });
});
