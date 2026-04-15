import type { ProblemStats } from "@/types";

export function storageKeyForSlug(slug: string): string {
  return `sql-coach:code:${slug}`;
}

/**
 * Rule: the editor starts blank for any problem the user has not
 * solved yet. Only after a successful submission do we restore
 * previously-saved code. Stale entries on unsolved problems are
 * cleared on load.
 */
export function loadInitialCode(
  slug: string,
  stats: ProblemStats | undefined,
  storage: Storage
): string {
  const key = storageKeyForSlug(slug);
  if (!stats?.solvedAt) {
    storage.removeItem(key);
    return "";
  }
  return storage.getItem(key) ?? "";
}

export function saveCode(
  slug: string,
  code: string,
  storage: Storage
): void {
  storage.setItem(storageKeyForSlug(slug), code);
}

export function clearSavedCode(slug: string, storage: Storage): void {
  storage.removeItem(storageKeyForSlug(slug));
}
