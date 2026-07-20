import { describe, it, expect } from "vitest";
import { buildExportItems } from "../src/core/exportPlan";

const base = "https://links.example.tld";

describe("buildExportItems", () => {
  it("marks existing bindings as alreadyLinked", () => {
    const md =
      "[On RAG](https://links.example.tld/links/842) and [ext](https://example.org)";
    const items = buildExportItems(md, base);
    expect(items).toHaveLength(2);
    expect(items[0].alreadyLinked).toBe(true);
    expect(items[1].alreadyLinked).toBe(false);
  });

  it("labels with the link text, else the url", () => {
    const md = "[Nice](https://a.tld) and https://b.tld";
    const items = buildExportItems(md, base);
    expect(items[0].label).toBe("Nice");
    expect(items[1].label).toBe("https://b.tld");
  });

  it("keeps reading order", () => {
    const md = "https://a.tld then [b](https://b.tld)";
    expect(buildExportItems(md, base).map((i) => i.link.url)).toEqual([
      "https://a.tld",
      "https://b.tld",
    ]);
  });
});
