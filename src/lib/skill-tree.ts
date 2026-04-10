/**
 * Skill tree defines the learning path through SQL categories.
 * Each node has prerequisites (what you should learn first) and
 * problems are ordered easy → medium → hard within each node.
 *
 * Navigation follows the tree: "Next" goes to the next problem in
 * the same category (by difficulty), then to the first problem in
 * the next unlocked category.
 */

export interface SkillNode {
  category: string;
  label: string;
  prerequisites: string[];
  tier: number; // 0 = foundation, 1 = core, 2 = intermediate, 3 = advanced
}

export const SKILL_TREE: SkillNode[] = [
  // Tier 0 — Foundation
  { category: "basic-select", label: "Basic SELECT", prerequisites: [], tier: 0 },

  // Tier 1 — Core
  { category: "joins", label: "Joins", prerequisites: ["basic-select"], tier: 1 },
  { category: "aggregation", label: "Aggregation", prerequisites: ["basic-select"], tier: 1 },
  { category: "conditional-logic", label: "Conditional Logic", prerequisites: ["basic-select"], tier: 1 },
  { category: "null-handling", label: "NULL Handling", prerequisites: ["basic-select"], tier: 1 },
  { category: "date-functions", label: "Date Functions", prerequisites: ["basic-select"], tier: 1 },
  { category: "string-functions", label: "String Functions", prerequisites: ["basic-select"], tier: 1 },

  // Tier 2 — Intermediate
  { category: "subqueries", label: "Subqueries", prerequisites: ["joins", "aggregation"], tier: 2 },
  { category: "window-functions", label: "Window Functions", prerequisites: ["aggregation"], tier: 2 },
  { category: "advanced-joins", label: "Advanced Joins", prerequisites: ["joins"], tier: 2 },
  { category: "pivoting", label: "Pivoting", prerequisites: ["aggregation", "conditional-logic"], tier: 2 },
  { category: "set-operations", label: "Set Operations", prerequisites: ["aggregation"], tier: 2 },
  { category: "data-quality", label: "Data Quality", prerequisites: ["joins", "aggregation"], tier: 2 },

  // Tier 3 — Advanced
  { category: "ctes", label: "CTEs", prerequisites: ["subqueries"], tier: 3 },
  { category: "gaps-and-islands", label: "Gaps & Islands", prerequisites: ["window-functions"], tier: 3 },
  { category: "business-analysis", label: "Business Analysis", prerequisites: ["subqueries", "ctes"], tier: 3 },
  { category: "cohort-analysis", label: "Cohort Analysis", prerequisites: ["window-functions"], tier: 3 },
];

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

/** Get the ordered list of categories following the skill tree */
export function getSkillTreeOrder(): string[] {
  // Topological sort by tier, then by position in the SKILL_TREE array
  return SKILL_TREE
    .sort((a, b) => a.tier - b.tier)
    .map((n) => n.category);
}

/** Get the skill node for a category */
export function getSkillNode(category: string): SkillNode | undefined {
  return SKILL_TREE.find((n) => n.category === category);
}

/**
 * Sort problems for navigation: grouped by skill tree order,
 * then by difficulty (easy → medium → hard) within each group.
 */
export function sortBySkillTree<T extends { category: string; difficulty: "easy" | "medium" | "hard"; slug: string }>(
  problems: T[]
): T[] {
  const order = getSkillTreeOrder();

  return [...problems].sort((a, b) => {
    const catA = order.indexOf(a.category);
    const catB = order.indexOf(b.category);
    // Categories not in the tree go to the end
    const orderA = catA >= 0 ? catA : order.length;
    const orderB = catB >= 0 ? catB : order.length;

    if (orderA !== orderB) return orderA - orderB;

    // Within same category, sort by difficulty
    const diffA = DIFFICULTY_ORDER[a.difficulty] ?? 1;
    const diffB = DIFFICULTY_ORDER[b.difficulty] ?? 1;
    if (diffA !== diffB) return diffA - diffB;

    // Same category + difficulty, sort by slug
    return a.slug.localeCompare(b.slug);
  });
}
