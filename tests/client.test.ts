import { describe, it, expect } from "vitest";
import { LinkwardenClient } from "../src/api/client";
import type { HttpClient, HttpRequest, HttpResponse } from "../src/api/http";

/**
 * A fake HttpClient that records the last request it received and replies with a
 * caller-supplied canned response. This keeps the client under test fully
 * deterministic and free of any real network I/O.
 */
function fakeHttp(response: HttpResponse): {
  http: HttpClient;
  lastRequest: () => HttpRequest | undefined;
} {
  let last: HttpRequest | undefined;
  const http: HttpClient = async (req) => {
    last = req;
    return response;
  };
  return { http, lastRequest: () => last };
}

const config = { baseUrl: "https://links.example.tld/", token: "secret-token" };

describe("LinkwardenClient.search", () => {
  it("hits the encoded search url with a Bearer header and returns links", async () => {
    const links = [{ id: 1, name: "First" }, { id: 2, name: "Second" }];
    const { http, lastRequest } = fakeHttp({
      status: 200,
      json: { data: { links } },
    });
    const client = new LinkwardenClient(http, config);

    const result = await client.search("hello world & friends");

    expect(result).toEqual(links);
    const req = lastRequest()!;
    expect(req.method).toBe("GET");
    // Trailing slash on the base is stripped; query is URL-encoded.
    expect(req.url).toBe(
      "https://links.example.tld/api/v1/search?searchQueryString=hello%20world%20%26%20friends",
    );
    expect(req.headers?.Authorization).toBe("Bearer secret-token");
  });

  it("returns [] when the envelope is missing data", async () => {
    const { http } = fakeHttp({ status: 200, json: {} });
    const client = new LinkwardenClient(http, config);
    expect(await client.search("x")).toEqual([]);
  });
});

describe("LinkwardenClient.getHighlights", () => {
  it("returns the response array and hits the right url", async () => {
    const highlights = [{ id: 10, text: "a" }, { id: 11, text: "b" }];
    const { http, lastRequest } = fakeHttp({
      status: 200,
      json: { response: highlights },
    });
    const client = new LinkwardenClient(http, config);

    const result = await client.getHighlights(42);

    expect(result).toEqual(highlights);
    const req = lastRequest()!;
    expect(req.url).toBe("https://links.example.tld/api/v1/links/42/highlights");
    expect(req.headers?.Authorization).toBe("Bearer secret-token");
  });

  it("returns [] when response is missing", async () => {
    const { http } = fakeHttp({ status: 200, json: {} });
    const client = new LinkwardenClient(http, config);
    expect(await client.getHighlights(42)).toEqual([]);
  });
});

describe("LinkwardenClient.checkConnection", () => {
  it("reports ok on a 2xx", async () => {
    const { http, lastRequest } = fakeHttp({ status: 200, json: { response: [] } });
    const client = new LinkwardenClient(http, config);
    const result = await client.checkConnection();
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(lastRequest()!.url).toBe(
      "https://links.example.tld/api/v1/collections",
    );
  });

  it("flags an auth failure on 401/403 without throwing", async () => {
    const { http } = fakeHttp({ status: 401, json: { response: "Unauthorized" } });
    const client = new LinkwardenClient(http, config);
    const result = await client.checkConnection();
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.message).toMatch(/token/i);
  });

  it("flags an unexpected status as a base-URL problem", async () => {
    const { http } = fakeHttp({ status: 404, text: "Not Found" });
    const client = new LinkwardenClient(http, config);
    const result = await client.checkConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/base URL/i);
  });

  it("reports a transport failure without throwing", async () => {
    const http = async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    };
    const client = new LinkwardenClient(http, config);
    const result = await client.checkConnection();
    expect(result.ok).toBe(false);
    expect(result.status).toBeUndefined();
    expect(result.message).toMatch(/Could not reach/i);
  });
});

describe("LinkwardenClient.recent", () => {
  it("hits search with no query and returns links, capped at the limit", async () => {
    const links = Array.from({ length: 15 }, (_, i) => ({ id: i + 1 }));
    const { http, lastRequest } = fakeHttp({
      status: 200,
      json: { data: { links } },
    });
    const client = new LinkwardenClient(http, config);

    const result = await client.recent(10);

    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({ id: 1 });
    const req = lastRequest()!;
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://links.example.tld/api/v1/search");
    expect(req.headers?.Authorization).toBe("Bearer secret-token");
  });

  it("returns [] when the envelope is missing data", async () => {
    const { http } = fakeHttp({ status: 200, json: {} });
    const client = new LinkwardenClient(http, config);
    expect(await client.recent()).toEqual([]);
  });

  it("throws on an error status", async () => {
    const { http } = fakeHttp({ status: 500, json: { response: "boom" } });
    const client = new LinkwardenClient(http, config);
    await expect(client.recent()).rejects.toThrow(/500/);
  });
});

describe("LinkwardenClient.getCollections", () => {
  it("returns id/name pairs and hits the right url", async () => {
    const { http, lastRequest } = fakeHttp({
      status: 200,
      json: {
        response: [
          { id: 1, name: "Reading", color: "#0ea5e9" },
          { id: 2, name: "Research" },
        ],
      },
    });
    const client = new LinkwardenClient(http, config);

    const result = await client.getCollections();

    expect(result).toEqual([
      { id: 1, name: "Reading" },
      { id: 2, name: "Research" },
    ]);
    const req = lastRequest()!;
    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://links.example.tld/api/v1/collections");
    expect(req.headers?.Authorization).toBe("Bearer secret-token");
  });

  it("drops entries missing an id or name", async () => {
    const { http } = fakeHttp({
      status: 200,
      json: { response: [{ id: 1 }, { name: "Nameless-owner" }, { id: 3, name: "Keep" }] },
    });
    const client = new LinkwardenClient(http, config);
    expect(await client.getCollections()).toEqual([{ id: 3, name: "Keep" }]);
  });

  it("returns [] when response is missing", async () => {
    const { http } = fakeHttp({ status: 200, json: {} });
    const client = new LinkwardenClient(http, config);
    expect(await client.getCollections()).toEqual([]);
  });

  it("throws on an error status", async () => {
    const { http } = fakeHttp({ status: 401, json: { response: "Unauthorized" } });
    const client = new LinkwardenClient(http, config);
    await expect(client.getCollections()).rejects.toThrow(/401/);
  });
});

describe("LinkwardenClient.createLink", () => {
  it("returns the created link on success", async () => {
    const link = { id: 99, name: "Created", url: "https://example.com" };
    const { http, lastRequest } = fakeHttp({
      status: 200,
      json: { response: link },
    });
    const client = new LinkwardenClient(http, config);

    const result = await client.createLink({ url: "https://example.com" } as never);

    expect(result).toEqual({ link, alreadyExists: false });
    const req = lastRequest()!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://links.example.tld/api/v1/links");
    expect(req.headers?.Authorization).toBe("Bearer secret-token");
    expect(req.headers?.["Content-Type"]).toBe("application/json");
    expect(req.body).toBe(JSON.stringify({ url: "https://example.com" }));
  });

  it("flags a duplicate (400 + 'already exists') without throwing", async () => {
    const { http } = fakeHttp({
      status: 400,
      json: { response: "Link already exists" },
    });
    const client = new LinkwardenClient(http, config);

    const result = await client.createLink({ url: "https://dup.com" } as never);

    expect(result).toEqual({ link: null, alreadyExists: true });
  });

  it("detects the duplicate message case-insensitively from text", async () => {
    const { http } = fakeHttp({
      status: 409,
      text: "This LINK ALREADY EXISTS in your collection",
    });
    const client = new LinkwardenClient(http, config);

    const result = await client.createLink({ url: "https://dup.com" } as never);
    expect(result).toEqual({ link: null, alreadyExists: true });
  });

  it("throws on any other error status", async () => {
    const { http } = fakeHttp({
      status: 500,
      json: { response: "Internal Server Error" },
    });
    const client = new LinkwardenClient(http, config);

    await expect(
      client.createLink({ url: "https://boom.com" } as never),
    ).rejects.toThrow(/500/);
  });
});
