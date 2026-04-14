import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { ProblemStats } from "@/types";
import {
  computeStreak,
  getSolvedCount,
  isReviewDue,
  recordAttempt,
} from "./stats";

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

const originalLocalStorage = globalThis.localStorage;

describe("stats", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("records attempts against the caller's local day", () => {
    const store = recordAttempt(
      "window-functions-1",
      true,
      3210,
      {
        now: new Date("2026-04-13T02:30:00Z"),
        timeZone: "America/New_York",
      }
    );

    expect(store.problems["window-functions-1"]?.solveHistory).toEqual([
      "2026-04-12",
    ]);
    expect(store.problems["window-functions-1"]?.nextReviewAt).toBe(
      "2026-04-17"
    );
    expect(store.global.activeDays).toEqual(["2026-04-12"]);
    expect(getSolvedCount(store)).toBe(1);
  });

  it("computes streaks relative to the provided local timezone", () => {
    const streak = computeStreak(["2026-04-10", "2026-04-11", "2026-04-12"], {
      now: new Date("2026-04-13T02:30:00Z"),
      timeZone: "America/New_York",
    });

    expect(streak).toBe(3);
  });

  it("checks review due status against the provided local timezone", () => {
    const stats: ProblemStats = {
      attempts: 2,
      solvedAt: "2026-04-12T00:15:00Z",
      lastAttemptAt: "2026-04-12T00:15:00Z",
      lastSolvedAt: "2026-04-12T00:15:00Z",
      hintsUsed: 0,
      solutionViewed: false,
      bestTimeMs: 1000,
      solveHistory: ["2026-04-12"],
      nextReviewAt: "2026-04-12",
    };

    expect(
      isReviewDue(stats, {
        now: new Date("2026-04-13T02:30:00Z"),
        timeZone: "America/New_York",
      })
    ).toBe(true);
  });
});
