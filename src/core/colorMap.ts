export interface ColorRule {
  callout: string;
  tag?: string;
}

export type ColorMap = Record<string, ColorRule>;

export const DEFAULT_COLOR_MAP: ColorMap = {
  yellow: { callout: "quote" },
  blue: { callout: "info", tag: "definition" },
  red: { callout: "warning", tag: "objection" },
  green: { callout: "success", tag: "idea" },
};

/**
 * Resolve a color (from the API) to a rule. Unknown colors fall back to
 * { callout: "quote" }. The incoming color is trimmed and lowercased before
 * lookup so callers do not need to normalize it themselves.
 */
export function resolveColor(map: ColorMap, color: string): ColorRule {
  const key = color.trim().toLowerCase();
  return map[key] ?? { callout: "quote" };
}
