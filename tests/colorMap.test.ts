import { describe, it, expect } from "vitest";
import {
  DEFAULT_COLOR_MAP,
  resolveColor,
  type ColorMap,
} from "../src/core/colorMap";

describe("resolveColor", () => {
  it("resolves each default key to its rule", () => {
    expect(resolveColor(DEFAULT_COLOR_MAP, "yellow")).toEqual({
      callout: "quote",
    });
    expect(resolveColor(DEFAULT_COLOR_MAP, "blue")).toEqual({
      callout: "info",
      tag: "definition",
    });
    expect(resolveColor(DEFAULT_COLOR_MAP, "red")).toEqual({
      callout: "warning",
      tag: "objection",
    });
    expect(resolveColor(DEFAULT_COLOR_MAP, "green")).toEqual({
      callout: "success",
      tag: "idea",
    });
  });

  it("falls back to { callout: 'quote' } for an unknown color", () => {
    expect(resolveColor(DEFAULT_COLOR_MAP, "purple")).toEqual({
      callout: "quote",
    });
  });

  it("looks up case- and whitespace-insensitively", () => {
    expect(resolveColor(DEFAULT_COLOR_MAP, "  YELLOW ")).toEqual({
      callout: "quote",
    });
    expect(resolveColor(DEFAULT_COLOR_MAP, "Blue")).toEqual({
      callout: "info",
      tag: "definition",
    });
  });

  it("lets a custom map override the defaults", () => {
    const custom: ColorMap = {
      yellow: { callout: "note", tag: "custom" },
    };
    expect(resolveColor(custom, "yellow")).toEqual({
      callout: "note",
      tag: "custom",
    });
    // colors not present in the custom map still fall back to quote
    expect(resolveColor(custom, "blue")).toEqual({ callout: "quote" });
  });
});
