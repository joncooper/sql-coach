export interface Problem {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  tags: string[];
  domain: string;
  tables: string[];
  description: string;
  hints: string[];
  order_matters: boolean;
  solution: string;
  expected_columns: string[];
}

export interface ProblemSummary {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  tags: string[];
  isGenerated?: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

export interface RowDiff {
  type: "missing" | "extra";
  row: unknown[];
}

export interface SubmitResult {
  pass: boolean;
  message: string;
  coaching: string;
  expected: { columns: string[]; rows: unknown[][] };
  actual: { columns: string[]; rows: unknown[][] };
  diff: RowDiff[];
  executionTimeMs: number;
}

export interface TableSchema {
  table_schema: string;
  table_name: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

// --- Stats & Mastery ---

export type MasteryLevel =
  | "unattempted"
  | "attempted"
  | "solved"
  | "practiced"
  | "mastered";

export interface ProblemStats {
  attempts: number;
  solvedAt: string | null;
  lastAttemptAt: string | null;
  lastSolvedAt: string | null;
  hintsUsed: number;
  solutionViewed: boolean;
  bestTimeMs: number | null;
  solveHistory: string[];
  nextReviewAt: string | null;
  starred?: boolean;
}

export interface GlobalStats {
  activeDays: string[];
  longestStreak: number;
}

export interface StatsStore {
  version: 2;
  problems: Record<string, ProblemStats>;
  global: GlobalStats;
}
