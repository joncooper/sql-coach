/**
 * Catalog filter context — tab-scoped persistence of the catalog view state
 * (difficulty filter, skill-tree section, sort) so that navigating to a
 * problem page can compute "next" within the same filtered slice.
 *
 * sessionStorage semantics:
 *   - survives navigation and refresh within the same tab
 *   - cleared when the tab closes
 *   - per-tab isolation keeps two catalog views in different tabs from
 *     trampling each other
 *
 * No version field: if the shape changes incompatibly, a parse failure
 * silently discards the old entry and the caller gets null.
 */

import type { ProblemSummary } from "@/types";

type Difficulty = ProblemSummary["difficulty"];
export type CatalogSortKey =
  | "num"
  | "title"
  | "difficulty"
  | "category"
  | "status";
export type CatalogSortDir = "asc" | "desc";

export interface CatalogContext {
  /** Active difficulty filter; [] means "all difficulties". */
  difficulty: Difficulty[];
  /** Highlighted skill-tree section; null means "all categories". */
  category: string | null;
  sortKey: CatalogSortKey;
  sortDir: CatalogSortDir;
  /** ISO timestamp of the last write. For debugging and hypothetical TTL. */
  updatedAt: string;
}

const KEY = "sql-coach:catalog-context";
const VALID_DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];
const VALID_SORT_KEYS: readonly CatalogSortKey[] = [
  "num",
  "title",
  "difficulty",
  "category",
  "status",
];

export function saveCatalogContext(ctx: CatalogContext): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    // Storage quota or disabled — fail quietly; filters still work in-memory.
  }
}

export function loadCatalogContext(): CatalogContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isCatalogContext(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCatalogContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

function isCatalogContext(value: unknown): value is CatalogContext {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.difficulty)) return false;
  if (!v.difficulty.every((d): d is Difficulty =>
    VALID_DIFFICULTIES.includes(d as Difficulty)
  )) {
    return false;
  }
  if (v.category !== null && typeof v.category !== "string") return false;
  if (!VALID_SORT_KEYS.includes(v.sortKey as CatalogSortKey)) return false;
  if (v.sortDir !== "asc" && v.sortDir !== "desc") return false;
  if (typeof v.updatedAt !== "string") return false;
  return true;
}
