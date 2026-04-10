import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Problem, ProblemSummary } from "@/types";
import { listGenerated } from "@/lib/generated";

const PROBLEMS_DIR = join(process.cwd(), "problems");

let cache: Map<string, Problem> | null = null;

async function loadAll(): Promise<Map<string, Problem>> {
  if (cache && process.env.NODE_ENV === "production") return cache;
  cache = new Map();
  const files = await readdir(PROBLEMS_DIR);
  for (const file of files.filter((f) => f.endsWith(".yml"))) {
    const raw = await readFile(join(PROBLEMS_DIR, file), "utf-8");
    const problem = yaml.load(raw) as Problem;
    cache.set(problem.slug, problem);
  }
  // Merge generated problems
  try {
    const generated = await listGenerated();
    for (const gp of generated) {
      if (!cache.has(gp.problem.slug)) {
        cache.set(gp.problem.slug, gp.problem);
      }
    }
  } catch {
    // generated/ dir might not exist yet
  }

  return cache;
}

export function invalidateCache(): void {
  cache = null;
}

// Track which slugs are generated
const generatedSlugs = new Set<string>();

export async function listProblems(): Promise<ProblemSummary[]> {
  const all = await loadAll();

  // Rebuild generated slugs set
  generatedSlugs.clear();
  try {
    const generated = await listGenerated();
    for (const gp of generated) {
      generatedSlugs.add(gp.problem.slug);
    }
  } catch {
    // ok
  }

  return Array.from(all.values())
    .map(({ slug, title, difficulty, category, tags }) => ({
      slug,
      title,
      difficulty,
      category,
      tags,
      isGenerated: generatedSlugs.has(slug),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function getProblem(slug: string): Promise<Problem | null> {
  const all = await loadAll();
  return all.get(slug) ?? null;
}

export async function getAdjacentSlugs(slug: string): Promise<{ prev: string | null; next: string | null }> {
  const list = await listProblems();
  const idx = list.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? list[idx - 1].slug : null,
    next: idx < list.length - 1 ? list[idx + 1].slug : null,
  };
}
