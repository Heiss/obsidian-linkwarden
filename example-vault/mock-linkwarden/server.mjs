#!/usr/bin/env node
// A tiny, dependency-free mock of the subset of the Linkwarden REST API the
// plugin uses, so the example vault demonstrates the plugin end-to-end without a
// real Linkwarden instance. It does NOT check auth. Port via PORT env (8788).

import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8788);

/** @type {Array<{id:number,name:string,url:string,collection?:object,tags?:object[]}>} */
const links = [
  {
    id: 1,
    name: "On Retrieval-Augmented Generation",
    url: "https://example.org/on-rag",
    collection: { id: 1, name: "Reading" },
    tags: [{ id: 1, name: "ml" }, { id: 2, name: "papers" }],
  },
  {
    id: 2,
    name: "The Nature of Order",
    url: "https://example.org/nature-of-order",
    collection: { id: 1, name: "Reading" },
    tags: [{ id: 3, name: "design" }],
  },
];

/** @type {Array<{id:number,name:string}>} */
const collections = [
  { id: 1, name: "Reading" },
  { id: 2, name: "Research" },
  { id: 3, name: "Archive" },
];

/** @type {Record<number, object[]>} */
const highlightsByLink = {
  1: [
    {
      id: 1571, linkId: 1, userId: 1, color: "yellow",
      text: "Retrieval-augmented generation grounds a model's output in an external corpus.",
      comment: "This is the core definition to remember.",
      startOffset: 10, endOffset: 92,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 1572, linkId: 1, userId: 1, color: "blue",
      text: "A retriever selects passages; a reader conditions on them.",
      comment: null,
      startOffset: 120, endOffset: 178,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 1573, linkId: 1, userId: 1, color: "red",
      text: "Naive chunking can split a claim from its evidence.",
      comment: "Objection: watch chunk boundaries.",
      startOffset: 200, endOffset: 251,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  2: [
    {
      id: 2001, linkId: 2, userId: 1, color: "green",
      text: "Wholeness is created by centers that reinforce one another.",
      comment: "Idea: apply to note structure.",
      startOffset: 5, endOffset: 63,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

let nextId = 100;

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(json);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  // GET /api/v1/search?searchQueryString=
  if (req.method === "GET" && path === "/api/v1/search") {
    const q = (url.searchParams.get("searchQueryString") ?? "").toLowerCase();
    const hits = links.filter(
      (l) =>
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.tags ?? []).some((t) => t.name.toLowerCase().includes(q)),
    );
    return send(res, 200, { message: "ok", data: { nextCursor: null, links: hits } });
  }

  // GET /api/v1/collections
  if (req.method === "GET" && path === "/api/v1/collections") {
    return send(res, 200, { response: collections });
  }

  // GET /api/v1/links/:id/highlights
  const hm = path.match(/^\/api\/v1\/links\/(\d+)\/highlights$/);
  if (req.method === "GET" && hm) {
    const id = Number(hm[1]);
    return send(res, 200, { response: highlightsByLink[id] ?? [] });
  }

  // POST /api/v1/links
  if (req.method === "POST" && path === "/api/v1/links") {
    const body = await readBody(req);
    const existing = links.find((l) => l.url === body.url);
    if (existing) {
      return send(res, 400, { response: "Link already exists." });
    }
    const link = {
      id: nextId++,
      name: body.name ?? body.url,
      url: body.url,
      collection: body.collection ?? { id: 1, name: "Unorganized" },
      tags: [],
    };
    links.push(link);
    highlightsByLink[link.id] = [];
    return send(res, 200, { response: link });
  }

  // Human-facing deep link pages (`/links/:id`, `/preserved/:id`,
  // `/public/links/:id`) — the real Linkwarden serves its web UI here; the mock
  // renders a tiny stub so clicking a binding in Obsidian shows something.
  const pm = path.match(/^\/(?:links|preserved|public\/links)\/(\d+)$/);
  if (req.method === "GET" && pm) {
    const id = Number(pm[1]);
    const link = links.find((l) => l.id === id);
    if (!link) return send(res, 404, { response: "Not found" });
    const hs = highlightsByLink[id] ?? [];
    const esc = (s) =>
      String(s).replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
      );
    const items = hs
      .map(
        (h) =>
          `<li><span style="border-left:4px solid ${esc(h.color)};padding-left:8px">${esc(h.text)}</span>${
            h.comment ? `<br><small><em>${esc(h.comment)}</em></small>` : ""
          }</li>`,
      )
      .join("");
    const html = `<!doctype html><meta charset="utf-8">
<title>${esc(link.name)} — mock Linkwarden</title>
<body style="font-family:system-ui;max-width:42rem;margin:3rem auto;padding:0 1rem">
<p style="color:#888">mock Linkwarden · link #${id}</p>
<h1>${esc(link.name)}</h1>
<p><a href="${esc(link.url)}">${esc(link.url)}</a></p>
<h2>Highlights (${hs.length})</h2>
<ul style="line-height:1.6">${items || "<li><em>none yet</em></li>"}</ul>
</body>`;
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    return res.end(html);
  }

  send(res, 404, { response: "Not found" });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-linkwarden] listening on http://localhost:${PORT}`);
});
