// Re-declared locally — evals/ runs outside Next.js, can't use @/ imports

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

export interface GeneratedProblem {
  schema_name: string;
  ddl: string;
  seed_data: string;
  problem: Problem;
}

export interface CoachingFixture {
  id: string;
  problem_slug: string;
  student_sql: string;
  error_context: string;
  attempt_number: number;
  rubric: {
    max_words: number;
    should_mention: string[];
    should_acknowledge_correct: string[];
  };
}

export interface CriterionResult {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface OllamaMetrics {
  latency_ms: number;
  tokens_per_sec: number;
  eval_count: number;
  prompt_eval_count: number;
}

export interface EvalResult {
  model: string;
  task: "problem-gen" | "coaching";
  run_id: string;
  criteria: CriterionResult[];
  score: number;
  max_score: number;
  metrics: OllamaMetrics;
  raw_response: string;
  thinking?: string;
}

export interface EvalConfig {
  models: string[];
  tasks: Array<"problem-gen" | "coaching">;
  runs: number;
  outputDir: string;
}
