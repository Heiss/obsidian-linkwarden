// Convenience aliases over the generated OpenAPI types (`schema.ts`). These stay
// in sync with the Linkwarden spec automatically — regenerate schema.ts with
// `npm run gen:api` when the upstream spec changes (see the drift test).

import type { components, paths } from "./schema";

/**
 * A link as returned across the API. The upstream schema leaves every field
 * optional; `id` is always present in practice, so we require it (it is the
 * binding key the whole plugin relies on).
 */
export type Link = Omit<components["schemas"]["Link"], "id"> & { id: number };

/** A collection as returned across the API. */
export type Collection = components["schemas"]["Collection"];

/**
 * The minimal collection shape the plugin needs to populate the default-collection
 * picker. `name` is what the F3 export sends; `id` disambiguates duplicate names.
 */
export interface CollectionSummary {
  id: number;
  name: string;
}

/** The `GET /api/v1/search` response envelope. */
export type SearchResponse =
  paths["/api/v1/search"]["get"]["responses"]["200"]["content"]["application/json"];

/** The request body for `POST /api/v1/links`. */
export type CreateLinkBody = NonNullable<
  paths["/api/v1/links"]["post"]["requestBody"]
>["content"]["application/json"];

type RawHighlight = NonNullable<
  paths["/api/v1/links/{id}/highlights"]["get"]["responses"]["200"]["content"]["application/json"]["response"]
>[number];

/**
 * A single highlight, as returned by `GET /api/v1/links/{id}/highlights`. The
 * upstream schema leaves every field optional; the plugin relies on these core
 * fields always being present, so we require them here (`comment` stays
 * optional — it genuinely may be absent).
 */
export type Highlight = Omit<
  RawHighlight,
  "id" | "text" | "color" | "startOffset" | "endOffset" | "linkId"
> & {
  id: number;
  text: string;
  color: string;
  startOffset: number;
  endOffset: number;
  linkId: number;
};
