// Official Obsidian community-plugin lint rules (eslint-plugin-obsidianmd).
// The recommended set is enforced. The sentence-case rule ships a brand and
// acronym dictionary; we extend it so the product name "Linkwarden" and the
// acronym "TTL" keep their casing, and we drop "Cursor" (the editor) from the
// brand list because in this plugin "cursor" always means the text cursor.
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import { DEFAULT_BRANDS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js";
import { DEFAULT_ACRONYMS } from "eslint-plugin-obsidianmd/dist/lib/rules/ui/acronyms.js";

const brands = [
  ...DEFAULT_BRANDS.filter((b) => b !== "Cursor"),
  "Linkwarden",
  // "Unorganized" is the name of Linkwarden's built-in default collection.
  "Unorganized",
];
const acronyms = [...DEFAULT_ACRONYMS, "TTL"];

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      "obsidianmd/ui/sentence-case": ["warn", { brands, acronyms }],
    },
  },
]);
