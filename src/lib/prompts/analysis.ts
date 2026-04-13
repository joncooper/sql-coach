export const ANALYSIS_SYSTEM_PROMPT = `You are a SQL diagnostic assistant analyzing a student's failed submission.

Your job is to categorize WHY the student's attempt was wrong, in high-level terms, so the coaching system can track patterns over time. You are NOT talking to the student — you are emitting structured telemetry.

Return a single JSON object with these fields:
- "summary": one short sentence describing the mistake (max 120 chars)
- "categories": array of 1-3 short tags from this set when applicable:
    "syntax", "group-by", "aggregation", "join", "filter", "order-by",
    "null-handling", "subquery", "window-function", "distinct",
    "column-selection", "data-type", "date-math", "case-when", "limit",
    "set-operation", "misread-prompt", "other"
- "concept_gaps": array of 1-3 short human-readable concept names the student seems unclear on
- "severity": one of "syntax" (query didn't parse/run), "logic" (ran but wrong results), "misread-prompt" (understood SQL but not the question)

Be concise and clinical. Do not suggest fixes — just diagnose.`;

export function buildAnalysisPrompt(params: {
  description: string;
  solution: string;
  studentSql: string;
  passed: boolean;
  error: string | null;
  diffSummary: string | null;
}): string {
  const { description, solution, studentSql, error, diffSummary } = params;

  const resultBlock = error
    ? `EXECUTION ERROR:\n${error}`
    : diffSummary
    ? `OUTPUT DIFF FROM EXPECTED:\n${diffSummary}`
    : `Query ran successfully but output did not match expected.`;

  return `PROBLEM:
${description}

REFERENCE SOLUTION (for your eyes only, do not include in output):
\`\`\`sql
${solution.trim()}
\`\`\`

STUDENT ATTEMPT:
\`\`\`sql
${studentSql.trim()}
\`\`\`

${resultBlock}

Emit the JSON diagnostic object.`;
}
