import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { EvalResult } from "../types.ts";

interface ModelTaskSummary {
  model: string;
  task: string;
  runs: number;
  avg_score: number;
  max_score: number;
  pct: number;
  avg_latency_ms: number;
  avg_tokens_per_sec: number;
}

function summarize(results: EvalResult[]): ModelTaskSummary[] {
  const groups = new Map<string, EvalResult[]>();

  for (const r of results) {
    const key = `${r.model}|${r.task}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const summaries: ModelTaskSummary[] = [];
  for (const [, group] of groups) {
    const avgScore =
      Math.round(
        (group.reduce((s, r) => s + r.score, 0) / group.length) * 10
      ) / 10;
    const maxScore = group[0].max_score;
    const avgLatency = Math.round(
      group.reduce((s, r) => s + r.metrics.latency_ms, 0) / group.length
    );
    const avgTokSec =
      Math.round(
        (group.reduce((s, r) => s + r.metrics.tokens_per_sec, 0) /
          group.length) *
          10
      ) / 10;

    summaries.push({
      model: group[0].model,
      task: group[0].task,
      runs: group.length,
      avg_score: avgScore,
      max_score: maxScore,
      pct: Math.round((avgScore / maxScore) * 100),
      avg_latency_ms: avgLatency,
      avg_tokens_per_sec: avgTokSec,
    });
  }

  return summaries;
}

export function printTable(results: EvalResult[]): void {
  const summaries = summarize(results);

  const header = [
    "Model".padEnd(20),
    "Task".padEnd(14),
    "Runs",
    "Score".padStart(7),
    "Pct".padStart(5),
    "Latency".padStart(9),
    "Tok/s".padStart(7),
  ].join("  ");

  const sep = "-".repeat(header.length);

  console.log("\n" + sep);
  console.log(header);
  console.log(sep);

  for (const s of summaries) {
    console.log(
      [
        s.model.padEnd(20),
        s.task.padEnd(14),
        String(s.runs).padStart(4),
        `${s.avg_score}/${s.max_score}`.padStart(7),
        `${s.pct}%`.padStart(5),
        `${s.avg_latency_ms}ms`.padStart(9),
        String(s.avg_tokens_per_sec).padStart(7),
      ].join("  ")
    );
  }

  console.log(sep + "\n");
}

export async function writeJsonReport(
  results: EvalResult[],
  outputDir: string
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `eval-${timestamp}.json`;
  const filepath = join(outputDir, filename);

  const report = {
    timestamp: new Date().toISOString(),
    summaries: summarize(results),
    results: results.map((r) => ({
      ...r,
      // Truncate very long raw responses in the report
      raw_response:
        r.raw_response.length > 5000
          ? r.raw_response.slice(0, 5000) + "... (truncated)"
          : r.raw_response,
      thinking:
        r.thinking && r.thinking.length > 2000
          ? r.thinking.slice(0, 2000) + "... (truncated)"
          : r.thinking,
    })),
  };

  await writeFile(filepath, JSON.stringify(report, null, 2));
  return filepath;
}
