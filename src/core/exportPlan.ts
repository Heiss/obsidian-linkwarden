// Classify a note's external links for the F3 export modal. Pure → unit-tested.

import { extractLinks, type ParsedLink } from "./links";
import { parseBindingId } from "./urls";

export interface ExportItem {
  link: ParsedLink;
  /** Already a binding on this instance → shown grayed, not preselected. */
  alreadyLinked: boolean;
  /** Readable label: the link text, else the url. */
  label: string;
}

/** Build the export item list for a note body, in reading order. */
export function buildExportItems(markdown: string, base: string): ExportItem[] {
  return extractLinks(markdown).map((link) => ({
    link,
    alreadyLinked: parseBindingId(link.url, base) !== null,
    label: (link.text && link.text.trim()) || link.url,
  }));
}
