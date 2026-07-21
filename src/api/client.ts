// The Linkwarden API client. It is deliberately free of any Obsidian
// dependency: it takes an injected `HttpClient` so it can be unit-tested with a
// fake, and adapted onto Obsidian's `requestUrl` in the plugin itself.

import type { HttpClient, HttpResponse } from "./http";
import type {
  Link,
  Highlight,
  CreateLinkBody,
  CollectionSummary,
} from "./models";

export interface ClientConfig {
  baseUrl: string;
  /** Linkwarden access token, sent as a Bearer credential. */
  token: string;
}

/** Outcome of a `createLink` call. */
export interface CreateLinkResult {
  /** The created (or existing) link, when known. */
  link: Link | null;
  /** True when the server rejected the request as a duplicate (D5). */
  alreadyExists: boolean;
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

/** Normalize the configured base URL by trimming whitespace and trailing slashes. */
function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, "");
}

/** Extract a parsed JSON body from a response, falling back to parsing `text`. */
function readJson(res: HttpResponse): unknown {
  if (res.json !== undefined) return res.json;
  if (res.text) {
    try {
      return JSON.parse(res.text);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export class LinkwardenClient {
  private readonly base: string;

  constructor(
    private readonly http: HttpClient,
    private readonly config: ClientConfig,
  ) {
    this.base = normalizeBase(config.baseUrl);
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.token}` };
  }

  private url(path: string): string {
    return `${this.base}${path}`;
  }

  /** GET /api/v1/search — returns `data.links`, or `[]` when absent. */
  async search(query: string): Promise<Link[]> {
    const res = await this.http({
      url: this.url(
        `/api/v1/search?searchQueryString=${encodeURIComponent(query)}`,
      ),
      method: "GET",
      headers: this.authHeaders(),
    });

    if (!isSuccess(res.status)) {
      throw new Error(
        `Linkwarden search failed (HTTP ${res.status}): ${errorMessage(res)}`,
      );
    }

    const body = readJson(res) as
      | { data?: { links?: Link[] } }
      | undefined;
    return body?.data?.links ?? [];
  }

  /**
   * GET /api/v1/collections — returns the user's collections as `{ id, name }`,
   * dropping any entry missing an id or name. Used to populate the
   * default-collection picker in settings.
   */
  async getCollections(): Promise<CollectionSummary[]> {
    const res = await this.http({
      url: this.url(`/api/v1/collections`),
      method: "GET",
      headers: this.authHeaders(),
    });

    if (!isSuccess(res.status)) {
      throw new Error(
        `Linkwarden getCollections failed (HTTP ${res.status}): ${errorMessage(res)}`,
      );
    }

    const body = readJson(res) as
      | { response?: Array<{ id?: number; name?: string }> }
      | undefined;
    const out: CollectionSummary[] = [];
    for (const c of body?.response ?? []) {
      if (typeof c.id === "number" && typeof c.name === "string") {
        out.push({ id: c.id, name: c.name });
      }
    }
    return out;
  }

  /** GET /api/v1/links/{id}/highlights — returns the `response` array, or `[]`. */
  async getHighlights(linkId: number): Promise<Highlight[]> {
    const res = await this.http({
      url: this.url(`/api/v1/links/${linkId}/highlights`),
      method: "GET",
      headers: this.authHeaders(),
    });

    if (!isSuccess(res.status)) {
      throw new Error(
        `Linkwarden getHighlights failed (HTTP ${res.status}): ${errorMessage(res)}`,
      );
    }

    const body = readJson(res) as { response?: Highlight[] } | undefined;
    return body?.response ?? [];
  }

  /**
   * POST /api/v1/links.
   * - 2xx → { link: response, alreadyExists: false }.
   * - 4xx whose error text/JSON `response` contains "already exists"
   *   (case-insensitive) → { link: null, alreadyExists: true }.
   * - any other non-2xx → throws.
   */
  async createLink(body: CreateLinkBody): Promise<CreateLinkResult> {
    const res = await this.http({
      url: this.url(`/api/v1/links`),
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (isSuccess(res.status)) {
      const parsed = readJson(res) as { response?: Link } | undefined;
      return { link: parsed?.response ?? null, alreadyExists: false };
    }

    if (res.status >= 400 && res.status < 500 && looksLikeDuplicate(res)) {
      return { link: null, alreadyExists: true };
    }

    throw new Error(
      `Linkwarden createLink failed (HTTP ${res.status}): ${errorMessage(res)}`,
    );
  }
}

/** Best-effort human-readable error message from a response. */
function errorMessage(res: HttpResponse): string {
  const parsed = readJson(res) as { response?: unknown } | undefined;
  if (parsed && typeof parsed.response === "string") return parsed.response;
  if (res.text) return res.text;
  return "unknown error";
}

/** Detect the server's "already exists" duplicate rejection. */
function looksLikeDuplicate(res: HttpResponse): boolean {
  const needle = "already exists";
  const parsed = readJson(res) as { response?: unknown } | undefined;
  if (
    parsed &&
    typeof parsed.response === "string" &&
    parsed.response.toLowerCase().includes(needle)
  ) {
    return true;
  }
  if (res.text && res.text.toLowerCase().includes(needle)) {
    return true;
  }
  return false;
}
