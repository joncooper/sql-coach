import { readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { EvalResult, CoachingFixture } from "../types.ts";
import { chat, type OllamaResult } from "../lib/ollama.ts";
import { loadProblem } from "../lib/db.ts";
import { judgeCoaching } from "../judges/coaching.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts/coaching.ts";

const FIXTURES_PATH = join(import.meta.dirname, "..", "fixtures", "coaching-cases.yml");

async function loadFixtures(): Promise<CoachingFixture[]> {
  const raw = await readFile(FIXTURES_PATH, "utf-8");
  return yaml.load(raw) as CoachingFixture[];
}

export async function runCoachingEval(model: string): Promise<EvalResult[]> {
  const fixtures = await loadFixtures();
  const results: EvalResult[] = [];

  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i];
    console.log(
      `  [${i + 1}/${fixtures.length}] ${fixture.id} (attempt ${fixture.attempt_number})...`
    );

    // Load the referenced problem for its description and solution
    let problem;
    try {
      problem = await loadProblem(fixture.problem_slug);
    } catch (err) {
      console.log(`    ERROR loading problem: ${(err as Error).message}`);
      results.push({
        model,
        task: "coaching",
        run_id: fixture.id,
        criteria: [{ name: "load_error", pass: false, detail: (err as Error).message }],
        score: 0,
        max_score: 5,
        metrics: { latency_ms: 0, tokens_per_sec: 0, eval_count: 0, prompt_eval_count: 0 },
        raw_response: "",
      });
      continue;
    }

    const userPrompt = buildUserPrompt({
      description: problem.description,
      tables: problem.tables,
      studentSql: fixture.student_sql,
      errorContext: fixture.error_context,
      attemptNumber: fixture.attempt_number,
    });

    let ollamaResult: OllamaResult;
    try {
      ollamaResult = await chat({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        // No format: "json" — coaching is natural language
      });
    } catch (err) {
      console.log(`    ERROR: ${(err as Error).message}`);
      results.push({
        model,
        task: "coaching",
        run_id: fixture.id,
        criteria: [{ name: "ollama_error", pass: false, detail: (err as Error).message }],
        score: 0,
        max_score: 5,
        metrics: { latency_ms: 0, tokens_per_sec: 0, eval_count: 0, prompt_eval_count: 0 },
        raw_response: "",
      });
      continue;
    }

    const criteria = judgeCoaching(
      ollamaResult.content,
      fixture,
      problem.solution
    );
    const score = criteria.filter((c) => c.pass).length;

    const passFail = criteria
      .map((c) => `${c.pass ? "+" : "-"}${c.name}${c.detail ? ` (${c.detail})` : ""}`)
      .join(", ");
    console.log(
      `    ${score}/5 | ${ollamaResult.latency_ms}ms | ${ollamaResult.tokens_per_sec} tok/s`
    );
    console.log(`    ${passFail}`);

    results.push({
      model,
      task: "coaching",
      run_id: fixture.id,
      criteria,
      score,
      max_score: 5,
      metrics: {
        latency_ms: ollamaResult.latency_ms,
        tokens_per_sec: ollamaResult.tokens_per_sec,
        eval_count: ollamaResult.eval_count,
        prompt_eval_count: ollamaResult.prompt_eval_count,
      },
      raw_response: ollamaResult.content,
      thinking: ollamaResult.thinking,
    });
  }

  return results;
}
