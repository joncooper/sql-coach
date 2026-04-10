import type { EvalResult } from "../types.ts";
import { chat, type OllamaResult } from "../lib/ollama.ts";
import { judgeProblemGen } from "../judges/problem-gen.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts/problem-gen.ts";

export async function runProblemGenEval(
  model: string,
  numRuns: number
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];

  for (let i = 0; i < numRuns; i++) {
    const { prompt, difficulty, domain, concept } = buildUserPrompt(i);
    const runId = `problem-gen-${i}`;

    console.log(
      `  [${i + 1}/${numRuns}] ${difficulty} problem about ${domain} (${concept})...`
    );

    let ollamaResult: OllamaResult;
    try {
      ollamaResult = await chat({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        format: "json",
        num_predict: 4096,
      });
    } catch (err) {
      console.log(`    ERROR: ${(err as Error).message}`);
      results.push({
        model,
        task: "problem-gen",
        run_id: runId,
        criteria: [{ name: "ollama_error", pass: false, detail: (err as Error).message }],
        score: 0,
        max_score: 7,
        metrics: { latency_ms: 0, tokens_per_sec: 0, eval_count: 0, prompt_eval_count: 0 },
        raw_response: "",
      });
      continue;
    }

    const { criteria } = await judgeProblemGen(ollamaResult.content);
    const score = criteria.filter((c) => c.pass).length;

    const passFail = criteria
      .map((c) => `${c.pass ? "+" : "-"}${c.name}${c.detail ? ` (${c.detail})` : ""}`)
      .join(", ");
    console.log(
      `    ${score}/7 | ${ollamaResult.latency_ms}ms | ${ollamaResult.tokens_per_sec} tok/s`
    );
    console.log(`    ${passFail}`);

    results.push({
      model,
      task: "problem-gen",
      run_id: runId,
      criteria,
      score,
      max_score: 7,
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
