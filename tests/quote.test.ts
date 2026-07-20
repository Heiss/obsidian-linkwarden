import { describe, it, expect } from "vitest";
import { blockId, hasBlockId, formatQuote, type QuoteOptions } from "../src/core/quote";
import { DEFAULT_COLOR_MAP } from "../src/core/colorMap";
import type { Highlight } from "../src/api/models";

function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
  return {
    id: 1571,
    text: "The highlighted text.",
    comment: null,
    color: "yellow",
    startOffset: 0,
    endOffset: 21,
    linkId: 42,
    ...overrides,
  } as Highlight;
}

const opts: QuoteOptions = {
  colorMap: DEFAULT_COLOR_MAP,
  sourceHref: "https://example.org/paper",
  sourceLabel: "On RAG",
};

describe("blockId", () => {
  it("builds the lw-<id> block id", () => {
    expect(blockId(1571)).toBe("lw-1571");
    expect(blockId(1)).toBe("lw-1");
  });
});

describe("hasBlockId", () => {
  it("returns true when the block id token is present", () => {
    expect(hasBlockId("some text ^lw-1571", 1571)).toBe(true);
    expect(hasBlockId("> quote ^lw-1571\nmore", 1571)).toBe(true);
  });

  it("returns false when the block id is absent", () => {
    expect(hasBlockId("no ids here", 1571)).toBe(false);
    expect(hasBlockId("", 1571)).toBe(false);
  });

  it("matches the whole token (boundary case)", () => {
    // ^lw-15 must NOT match when only ^lw-157 is present
    expect(hasBlockId("text ^lw-157", 15)).toBe(false);
    expect(hasBlockId("text ^lw-1571", 157)).toBe(false);
    // but the exact id does match even next to other ids
    expect(hasBlockId("text ^lw-1571 ^lw-15", 15)).toBe(true);
  });
});

describe("formatQuote", () => {
  it("formats a highlight WITH a comment (yellow -> quote, no tag)", () => {
    const h = makeHighlight({ comment: "my comment" });
    expect(formatQuote(h, opts)).toBe(
      [
        "> [!quote] [On RAG](https://example.org/paper)",
        "> The highlighted text.",
        ">",
        "> **Note:** my comment ^lw-1571",
      ].join("\n"),
    );
  });

  it("formats a highlight WITHOUT a comment, block id on last text line", () => {
    const h = makeHighlight({ comment: null });
    expect(formatQuote(h, opts)).toBe(
      [
        "> [!quote] [On RAG](https://example.org/paper)",
        "> The highlighted text. ^lw-1571",
      ].join("\n"),
    );
  });

  it("appends the tag to the title line (blue -> info + definition)", () => {
    const h = makeHighlight({ color: "blue", comment: null });
    expect(formatQuote(h, opts)).toBe(
      [
        "> [!info] [On RAG](https://example.org/paper) #definition",
        "> The highlighted text. ^lw-1571",
      ].join("\n"),
    );
  });

  it("appends the tag even when there is a comment", () => {
    const h = makeHighlight({ color: "blue", comment: "note here" });
    expect(formatQuote(h, opts)).toBe(
      [
        "> [!info] [On RAG](https://example.org/paper) #definition",
        "> The highlighted text.",
        ">",
        "> **Note:** note here ^lw-1571",
      ].join("\n"),
    );
  });

  it("prefixes every line of multi-line text", () => {
    const h = makeHighlight({ text: "line one\nline two\nline three", comment: null });
    expect(formatQuote(h, opts)).toBe(
      [
        "> [!quote] [On RAG](https://example.org/paper)",
        "> line one",
        "> line two",
        "> line three ^lw-1571",
      ].join("\n"),
    );
  });

  it("treats a whitespace-only comment as no comment", () => {
    const h = makeHighlight({ comment: "   " });
    expect(formatQuote(h, opts)).toBe(
      [
        "> [!quote] [On RAG](https://example.org/paper)",
        "> The highlighted text. ^lw-1571",
      ].join("\n"),
    );
  });

  it("falls back to the quote callout for an unknown color", () => {
    const h = makeHighlight({ color: "chartreuse", comment: null });
    expect(formatQuote(h, opts)).toBe(
      [
        "> [!quote] [On RAG](https://example.org/paper)",
        "> The highlighted text. ^lw-1571",
      ].join("\n"),
    );
  });
});
