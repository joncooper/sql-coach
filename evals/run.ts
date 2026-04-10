import { ensureModel } from "./lib/ollama.ts";
import { cleanupStaleSchemas, shutdown } from "./lib/db.ts";
import { runProblemGenEval } from "./tasks/problem-gen.ts";
import { runCoachingEval } from "./tasks/coaching.ts";
import { printTable, writeJsonReport } from "./lib/report.ts";
import { join } from "node:path";
import type { EvalConfig, EvalResult } from "./types.ts";

function parseArgs(argv: string[]): EvalConfig {
  const args = argv.slice(2);
  let models: string[] = [];
  let tasks: Array<"problem-gen" | "coaching"> = [];
  let runs = 3;
  let outputDir = join(import.meta.dirname, "results");

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--models" && args[i + 1]) {
      models = args[++i].split(",").map((s) => s.trim());
    } else if (arg === "--tasks" && args[i + 1]) {
      tasks = args[++i].split(",").map((s) => s.trim()) as typeof tasks;
    } else if (arg === "--runs" && args[i + 1]) {
      runs = parseInt(args[++i], 10);
    } else if (arg === "--out" && args[i + 1]) {
      outputDir = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bun run evals/run.ts --models <model1,model2> [options]

Options:
  --models <names>   Comma-separated Ollama model names (required)
  --tasks <names>    Tasks to run: problem-gen, coaching (default: both)
  --runs <n>         Number of problem-gen runs per model (default: 3)
  --out <dir>        Output directory (default: evals/results/)
  -h, --help         Show this help`);
      process.exit(0);
    }
  }

  if (models.length === 0) {
    console.error("Error: --models is required. Use --help for usage.");
    process.exit(1);
  }

  if (tasks.length === 0) {
    tasks = ["problem-gen", "coaching"];
  }

  return { models, tasks, runs, outputDir };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv);

  console.log("SQL Coach Eval Harness");
  console.log(`Models: ${config.models.join(", ")}`);
  console.log(`Tasks: ${config.tasks.join(", ")}`);
  console.log(`Problem-gen runs per model: ${config.runs}`);
  console.log();

  // Cleanup any leftover eval schemas from prior runs
  const cleaned = await cleanupStaleSchemas();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} stale eval schema(s)`);
  }

  // Verify all models exist
  for (const model of config.models) {
    await ensureModel(model);
    console.log(`Model OK: ${model}`);
  }
  console.log();

  const allResults: EvalResult[] = [];

  for (const model of config.models) {
    console.log(`=== ${model} ===`);

    if (config.tasks.includes("problem-gen")) {
      console.log(`\n--- problem-gen (${config.runs} runs) ---`);
      const results = await runProblemGenEval(model, config.runs);
      allResults.push(...results);
    }

    if (config.tasks.includes("coaching")) {
      console.log(`\n--- coaching ---`);
      const results = await runCoachingEval(model);
      allResults.push(...results);
    }

    console.log();
  }

  // Print summary table
  printTable(allResults);

  // Write detailed JSON report
  const reportPath = await writeJsonReport(allResults, config.outputDir);
  console.log(`Detailed report: ${reportPath}`);

  await shutdown();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
