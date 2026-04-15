import { beforeEach, describe, expect, it } from "bun:test";
import type { ProblemStats } from "@/types";
import {
  clearSavedCode,
  loadInitialCode,
  saveCode,
  storageKeyForSlug,
} from "./problemCode";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function makeStats(overrides: Partial<ProblemStats> = {}): ProblemStats {
  return {
    attempts: 0,
    solvedAt: null,
    lastAttemptAt: null,
    lastSolvedAt: null,
    hintsUsed: 0,
    solutionViewed: false,
    bestTimeMs: null,
    solveHistory: [],
    nextReviewAt: null,
    ...overrides,
  };
}

describe("loadInitialCode", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("returns empty string for a never-attempted problem", () => {
    expect(loadInitialCode("array-agg-tags", undefined, storage)).toBe("");
  });

  it("returns empty string for a problem attempted but not solved", () => {
    const stats = makeStats({ attempts: 3, lastAttemptAt: "2026-04-15" });
    expect(loadInitialCode("array-agg-tags", stats, storage)).toBe("");
  });

  it("ignores stale localStorage on an unsolved problem", () => {
    storage.setItem(
      storageKeyForSlug("array-agg-tags"),
      "SELECT * FROM hr.employees -- stale from earlier schema"
    );
    const stats = makeStats({ attempts: 1 });
    expect(loadInitialCode("array-agg-tags", stats, storage)).toBe("");
  });

  it("clears stale localStorage on an unsolved problem", () => {
    const key = storageKeyForSlug("array-agg-tags");
    storage.setItem(key, "SELECT stale FROM whatever");
    loadInitialCode("array-agg-tags", undefined, storage);
    expect(storage.getItem(key)).toBeNull();
  });

  it("returns saved code when the problem has been solved", () => {
    const code = "SELECT c.name, ARRAY_AGG(p.price) FROM products p JOIN categories c ON c.id = p.category_id GROUP BY c.name;";
    saveCode("array-agg-tags", code, storage);
    const stats = makeStats({
      attempts: 2,
      solvedAt: "2026-04-10T00:00:00.000Z",
      lastSolvedAt: "2026-04-10T00:00:00.000Z",
      solveHistory: ["2026-04-10"],
    });
    expect(loadInitialCode("array-agg-tags", stats, storage)).toBe(code);
  });

  it("returns empty string when solved but no code has been saved yet", () => {
    const stats = makeStats({
      attempts: 1,
      solvedAt: "2026-04-10T00:00:00.000Z",
      lastSolvedAt: "2026-04-10T00:00:00.000Z",
      solveHistory: ["2026-04-10"],
    });
    expect(loadInitialCode("array-agg-tags", stats, storage)).toBe("");
  });

  it("does not leak code between slugs", () => {
    saveCode("array-agg-tags", "SELECT 1;", storage);
    const solved = makeStats({
      solvedAt: "2026-04-10T00:00:00.000Z",
      lastSolvedAt: "2026-04-10T00:00:00.000Z",
      solveHistory: ["2026-04-10"],
    });
    expect(loadInitialCode("array-agg-tags", solved, storage)).toBe(
      "SELECT 1;"
    );
    expect(loadInitialCode("second-highest-salary", solved, storage)).toBe("");
  });
});

describe("saveCode / clearSavedCode", () => {
  it("round-trips through storage", () => {
    const storage = new MemoryStorage();
    saveCode("x", "SELECT 1;", storage);
    expect(storage.getItem(storageKeyForSlug("x"))).toBe("SELECT 1;");
    clearSavedCode("x", storage);
    expect(storage.getItem(storageKeyForSlug("x"))).toBeNull();
  });
});
