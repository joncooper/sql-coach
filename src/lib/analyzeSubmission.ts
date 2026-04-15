import { chat } from "@/lib/ollama";
import { getProblem } from "@/lib/problems";
import { setAnalysis, setAnalysisError, type Analysis } from "@/lib/tracking";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
} from "@/lib/prompts/analysis";

export async function analyzeSubmission(params: {
  submissionId: number;
  slug: string;
  studentSql: string;
  error: string | null;
  diffSummary: string | null;
}): Promise<void> {
  const { submissionId, slug, studentSql, error, diffSummary } = params;

  try {
    const problem = await getProblem(slug);
    if (!problem) {
      await setAnalysisError(submissionId, `problem not found: ${slug}`);
      return;
    }

    const userPrompt = buildAnalysisPrompt({
      description: problem.description,
      solution: problem.solution,
      studentSql,
      passed: false,
      error,
      diffSummary,
    });

    const { content } = await chat({
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      format: "json",
      // Gemma burns a large chunk of tokens on internal reasoning before
      // emitting JSON content. 400 was too tight for problems with long
      // descriptions — runs hit `done_reason: length` with an empty
      // content payload. 2048 leaves ample headroom for the model to
      // think and then actually produce the diagnostic.
      num_predict: 2048,
    });

    const parsed = parseAnalysis(content);
    if (!parsed) {
      await setAnalysisError(
        submissionId,
        `could not parse analysis JSON: ${content.slice(0, 200)}`
      );
      return;
    }

    await setAnalysis(submissionId, parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setAnalysisError(submissionId, msg).catch(() => {});
  }
}

function parseAnalysis(content: string): Analysis | null {
  try {
    // Some models wrap JSON in ```json fences even in format=json mode.
    const stripped = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const obj = JSON.parse(stripped);
    if (typeof obj.summary !== "string") return null;
    const categories = Array.isArray(obj.categories)
      ? obj.categories.filter((c: unknown): c is string => typeof c === "string")
      : [];
    const concept_gaps = Array.isArray(obj.concept_gaps)
      ? obj.concept_gaps.filter((c: unknown): c is string => typeof c === "string")
      : [];
    const severity: Analysis["severity"] =
      obj.severity === "syntax" ||
      obj.severity === "logic" ||
      obj.severity === "misread-prompt"
        ? obj.severity
        : "unknown";
    return {
      summary: obj.summary,
      categories,
      concept_gaps,
      severity,
    };
  } catch {
    return null;
  }
}
