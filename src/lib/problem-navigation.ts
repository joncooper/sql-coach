/**
 * Problem-page "Next" navigation.
 *
 * The catalog screen filters by difficulty and skill-tree section and sorts
 * by any of five columns. When the user opens a problem from that filtered
 * view and solves it, "Next problem" should stay within the filter rather
 * than jumping to whatever comes next in global skill-tree order.
 *
 * This module is the shared nav computation used by AcceptedModal on the
 * problem page. The catalog view itself still uses its own local comparators
 * for table sorting; they call into {@link sortCatalog} below to stay in
 * lock-step.
 */

import type { MasteryLevel, ProblemSummary, StatsStore } from "@/types";
import { sortBySkillTree, SKILL_TREE, getSkillNode } from "@/lib/skill-tree";
import { computeMasteryLevel } from "@/lib/stats";
import type { CatalogContext, CatalogSortKey, CatalogSortDir } from "./catalog-context";

const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

const LEVEL_ORDER: Record<MasteryLevel, number> = {
  unattempted: 0,
  attempted: 1,
  solved: 2,
  practiced: 3,
  mastered: 4,
};

export type NextKind = "next" | "end-of-filter" | "end-of-catalog";

export interface NextResult {
  kind: NextKind;
  /** The slug to navigate to for a primary CTA; null when nothing to offer. */
  slug: string | null;
  /** Human-readable label of the filter that was just exhausted (e.g. "Medium · Joins"). */
  filterLabel?: string;
  /** For end-of-filter in a section: the first problem in the *next* section matching the difficulty filter. */
  nextSectionSlug?: string | null;
  nextSectionLabel?: string | null;
}

/**
 * Sort a filtered list of problems with the same comparator the catalog table
 * uses. Pure: no stats access for non-status keys.
 */
export function sortCatalog(
  problems: ProblemSummary[],
  sortKey: CatalogSortKey,
  sortDir: CatalogSortDir,
  levelByProblem?: Map<string, MasteryLevel>,
): ProblemSummary[] {
  // "num" preserves the filtered-array order, which for API-fed problems
  // is already sortBySkillTree. Mirror that contract here: apply skill-tree
  // order before any key-specific sort, then re-sort if the key isn't "num".
  const base = sortBySkillTree(problems);
  if (sortKey === "num") {
    return sortDir === "asc" ? base : [...base].reverse();
  }

  const dir = sortDir === "asc" ? 1 : -1;
  const arr = [...base];
  arr.sort((a, b) => {
    switch (sortKey) {
      case "title":
        return a.title.localeCompare(b.title) * dir;
      case "difficulty":
        return (DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]) * dir;
      case "category":
        return a.category.localeCompare(b.category) * dir;
      case "status": {
        const la = LEVEL_ORDER[levelByProblem?.get(a.slug) ?? "unattempted"];
        const lb = LEVEL_ORDER[levelByProblem?.get(b.slug) ?? "unattempted"];
        return (la - lb) * dir;
      }
    }
    return 0;
  });
  return arr;
}

function applyFilter(
  problems: ProblemSummary[],
  ctx: CatalogContext,
): ProblemSummary[] {
  const diffSet = new Set(ctx.difficulty);
  return problems.filter((p) => {
    if (ctx.category && p.category !== ctx.category) return false;
    if (diffSet.size > 0 && !diffSet.has(p.difficulty)) return false;
    return true;
  });
}

/**
 * Build a Map<slug, MasteryLevel> for a problem set. Needed only when the
 * catalog's sort key is "status"; other keys don't touch stats.
 */
export function buildLevelMap(
  problems: ProblemSummary[],
  store: StatsStore,
): Map<string, MasteryLevel> {
  const map = new Map<string, MasteryLevel>();
  for (const p of problems) {
    map.set(
      p.slug,
      computeMasteryLevel(store.problems[p.slug], p.difficulty),
    );
  }
  return map;
}

function formatCategoryLabel(category: string): string {
  return (
    getSkillNode(category)?.label ??
    category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function difficultyLabel(difficulty: ProblemSummary["difficulty"]): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

function filterLabelFor(ctx: CatalogContext): string {
  const parts: string[] = [];
  if (ctx.difficulty.length > 0) {
    parts.push(ctx.difficulty.map(difficultyLabel).join(" · "));
  }
  if (ctx.category) parts.push(formatCategoryLabel(ctx.category));
  return parts.join(" · ");
}

/**
 * Find the next skill-tree category (after `currentCategory`) that contains
 * at least one problem matching the difficulty filter. Returns the first
 * matching problem's slug plus the category's display label.
 */
function findNextSection(
  problems: ProblemSummary[],
  ctx: CatalogContext,
  currentCategory: string,
): { slug: string; label: string } | null {
  const treeOrder = SKILL_TREE.map((n) => n.category);
  const currentIdx = treeOrder.indexOf(currentCategory);
  if (currentIdx === -1) return null;

  const diffSet = new Set(ctx.difficulty);
  const matchesDifficulty = (p: ProblemSummary) =>
    diffSet.size === 0 || diffSet.has(p.difficulty);

  // Pre-sort once so we pick the *first* problem of each candidate section
  // in the canonical catalog order (skill-tree, then easy→medium→hard, then slug).
  const sorted = sortBySkillTree(problems);

  for (let i = currentIdx + 1; i < treeOrder.length; i++) {
    const cat = treeOrder[i];
    const candidate = sorted.find(
      (p) => p.category === cat && matchesDifficulty(p),
    );
    if (candidate) {
      return { slug: candidate.slug, label: formatCategoryLabel(cat) };
    }
  }
  return null;
}

/**
 * Compute what "Next problem" should point to from the currently-displayed
 * problem, taking the saved catalog context into account.
 *
 * - Without a context, falls back to global skill-tree order.
 * - With a context, stays inside the filter slice; when the slice is
 *   exhausted but a skill-tree category was highlighted, proposes the next
 *   category's first matching problem as `nextSectionSlug`.
 */
export function computeNext(
  currentSlug: string,
  problems: ProblemSummary[],
  ctx: CatalogContext | null,
  levelByProblem?: Map<string, MasteryLevel>,
): NextResult {
  // No context → plain skill-tree walk (today's behavior).
  if (!ctx) {
    const sorted = sortBySkillTree(problems);
    const idx = sorted.findIndex((p) => p.slug === currentSlug);
    if (idx === -1 || idx === sorted.length - 1) {
      return { kind: "end-of-catalog", slug: null };
    }
    return { kind: "next", slug: sorted[idx + 1].slug };
  }

  const filtered = applyFilter(problems, ctx);
  const sorted = sortCatalog(filtered, ctx.sortKey, ctx.sortDir, levelByProblem);
  const idx = sorted.findIndex((p) => p.slug === currentSlug);

  // Current problem not in the filtered slice (e.g. filters changed after
  // navigating). Fall back to the global skill-tree walk so the button
  // still does *something* sensible.
  if (idx === -1) {
    const treeSorted = sortBySkillTree(problems);
    const treeIdx = treeSorted.findIndex((p) => p.slug === currentSlug);
    if (treeIdx === -1 || treeIdx === treeSorted.length - 1) {
      return { kind: "end-of-catalog", slug: null };
    }
    return { kind: "next", slug: treeSorted[treeIdx + 1].slug };
  }

  // Normal case: next in the filtered slice.
  if (idx < sorted.length - 1) {
    return { kind: "next", slug: sorted[idx + 1].slug };
  }

  // End-of-filter. If a category was pinned, try the next skill-tree section.
  const label = filterLabelFor(ctx);
  if (ctx.category) {
    const nextSection = findNextSection(problems, ctx, ctx.category);
    return {
      kind: "end-of-filter",
      slug: null,
      filterLabel: label || undefined,
      nextSectionSlug: nextSection?.slug ?? null,
      nextSectionLabel: nextSection?.label ?? null,
    };
  }

  // Pure difficulty filter exhausted: no "next section" concept, just done.
  return {
    kind: "end-of-filter",
    slug: null,
    filterLabel: label || undefined,
    nextSectionSlug: null,
    nextSectionLabel: null,
  };
}
