import { resolveColor, type ColorMap } from "./colorMap";
import type { Highlight } from "../api/models";

/** The Obsidian block id for a highlight, e.g. blockId(1571) === "lw-1571". */
export function blockId(highlightId: number): string {
  return `lw-${highlightId}`;
}

/**
 * True if the note text already contains the block id `^lw-<id>` as a whole
 * token. `^lw-15` must NOT match when only `^lw-157` is present, so the match
 * is bounded by a non-digit (or end of string) on the right.
 */
export function hasBlockId(noteText: string, highlightId: number): boolean {
  const re = new RegExp(`\\^lw-${highlightId}(?![0-9])`);
  return re.test(noteText);
}

/** Whitespace-only (or empty) is a blank line in Markdown. */
function isBlank(line: string): boolean {
  return line.trim() === "";
}

/**
 * Newlines to insert *before* a block so it starts on its own blank-line-separated
 * block, given the text immediately preceding the insertion point. A callout
 * glued to the previous line is absorbed into it, so we guarantee a blank line
 * unless we are at the very start of the document.
 */
export function blockSeparatorBefore(before: string): string {
  if (before === "") return "";
  const lines = before.split("\n");
  const current = lines[lines.length - 1]; // text on the cursor's line, before it
  const previous = lines.length >= 2 ? lines[lines.length - 2] : "";
  if (!isBlank(current)) return "\n\n"; // mid-line: end it, then a blank line
  if (isBlank(previous)) return ""; // already blank-line separated
  return "\n"; // on a fresh line whose predecessor has content
}

/**
 * Newlines to insert *after* a block, given the text immediately following the
 * insertion point, so following content is not lazily pulled into the block.
 */
export function blockSeparatorAfter(after: string): string {
  if (after === "") return "\n";
  if (after.startsWith("\n")) return "\n"; // existing newline completes the gap
  return "\n\n"; // content butts up against the block → force a blank line
}

export interface QuoteOptions {
  colorMap: ColorMap;
  /** Source deep-link (the binding href). */
  sourceHref: string;
  /** Readable label for the callout title. */
  sourceLabel: string;
}

/**
 * Render the highlight as an Obsidian callout block. Returns the multi-line
 * string (no trailing newline).
 */
export function formatQuote(h: Highlight, opts: QuoteOptions): string {
  const rule = resolveColor(opts.colorMap, h.color);
  const idSuffix = ` ^${blockId(h.id)}`;

  let title = `> [!${rule.callout}] [${opts.sourceLabel}](${opts.sourceHref})`;
  if (rule.tag) {
    title += ` #${rule.tag}`;
  }

  const comment =
    typeof h.comment === "string" && h.comment.trim() !== ""
      ? h.comment.trim()
      : null;

  const textLines = h.text.split("\n").map((line) => `> ${line}`);

  const lines = [title, ...textLines];

  if (comment) {
    lines.push(">");
    lines.push(`> **Note:** ${comment}${idSuffix}`);
  } else {
    lines[lines.length - 1] = `${lines[lines.length - 1]}${idSuffix}`;
  }

  return lines.join("\n");
}
