import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const UPSTREAM_URL =
  "https://raw.githubusercontent.com/linkwarden/docs/main/openapi/linkwarden.yaml";

const here = dirname(fileURLToPath(import.meta.url));
const LOCAL_PATH = resolve(here, "..", "openapi", "linkwarden.yaml");

/** Normalize line endings (CRLF/CR → LF) and strip trailing whitespace per line. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Index of the first differing line (1-based), or -1 when identical. */
function firstDiffLine(a: string, b: string): number {
  const la = a.split("\n");
  const lb = b.split("\n");
  const max = Math.max(la.length, lb.length);
  for (let i = 0; i < max; i++) {
    if (la[i] !== lb[i]) return i + 1;
  }
  return -1;
}

describe("OpenAPI spec drift", () => {
  it(
    "vendored openapi/linkwarden.yaml matches upstream",
    async () => {
      const local = normalize(readFileSync(LOCAL_PATH, "utf8"));

      let upstreamRaw: string;
      try {
        const res = await fetch(UPSTREAM_URL, {
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          console.warn(
            `[openapi-drift] Skipping: upstream fetch returned HTTP ${res.status}. Staying green.`,
          );
          return;
        }
        upstreamRaw = await res.text();
      } catch (err) {
        console.warn(
          `[openapi-drift] Skipping drift check (offline / network error): ${String(
            err,
          )}. Staying green.`,
        );
        return;
      }

      const upstream = normalize(upstreamRaw);

      if (sha256(local) !== sha256(upstream)) {
        const line = firstDiffLine(local, upstream);
        throw new Error(
          "Upstream Linkwarden OpenAPI spec changed — run `npm run gen:api` to " +
            "regenerate src/api/schema.ts and re-vendor openapi/linkwarden.yaml." +
            (line > 0 ? ` First differing line: ${line}.` : ""),
        );
      }

      expect(sha256(local)).toBe(sha256(upstream));
    },
    25000,
  );
});
