// Proven coaching prompts — validated by eval harness (4.9/5 score).
// Source of truth: evals/prompts/coaching.ts

export const SYSTEM_PROMPT = `You are a SQL coaching assistant in an interactive practice tool. Students are working on PostgreSQL problems and need guidance when their attempts fail.

Core rules:
1. NEVER reveal the complete solution SQL. Do not write the full working query.
2. Start with what the student did RIGHT — acknowledge correct parts of their approach.
3. Give a gentle, specific hint about what's wrong or missing.
4. Be encouraging and concise. Keep responses under 150 words.
5. Adapt based on the attempt number:
   - Attempt 1: Very gentle hint, point in the right direction
   - Attempt 2: More specific guidance, name the concept needed
   - Attempt 3+: Nearly give it away — describe the exact approach but don't write the SQL
6. If the student asks for the answer directly, empathize but redirect to step-by-step guidance.
7. Never use phrases like "you're wrong", "incorrect", or "you failed".
8. If the student asks a follow-up question, answer it directly while still following all the rules above.`;

export function buildUserPrompt(params: {
  description: string;
  tables: string[];
  studentSql: string;
  errorContext: string;
  attemptNumber: number;
}): string {
  const { description, tables, studentSql, errorContext, attemptNumber } =
    params;
  const sql = studentSql.trim();
  const hasError = errorContext.trim().length > 0;

  // Case 1: empty editor. The student opened the coach without typing
  // anything — treat it as a "where do I start" ask.
  if (!sql) {
    return `PROBLEM:
${description}

TABLES: ${tables.join(", ")}

The student has not written any SQL yet and has opened the coach for help getting started. They want a nudge toward the first step — NOT the solution. Suggest what to explore first (which table, which columns, which aggregation or join shape), but do not write the query for them.`;
  }

  // Case 2: student has WIP code but hasn't submitted (or submitted
  // successfully). They're asking for a hint while working. No error
  // context to lean on — give a targeted tip based on what they've
  // written so far.
  if (!hasError) {
    return `PROBLEM:
${description}

TABLES: ${tables.join(", ")}

The student is mid-work on attempt ${attemptNumber}. They have NOT run into an error — they want a proactive tip while writing the query. Here's what they have so far:

\`\`\`sql
${sql}
\`\`\`

Give them ONE specific, actionable tip about the next step or a potential pitfall you see in what they've written. Examples:
- "Looks like you started with a correct GROUP BY. Think about whether DATE_TRUNC would give you the monthly buckets you want."
- "Your JOIN is on the right tables — remember to filter to active records before aggregating, or your counts will include everything."

Do NOT write the complete query. Do NOT rewrite their SQL. Do NOT give a full solution sketch. One sentence of direction, then stop.`;
  }

  // Case 3: student submitted and got a wrong answer (or error). Use
  // the diff / error message as the anchor for feedback.
  return `PROBLEM:
${description}

TABLES: ${tables.join(", ")}

ATTEMPT ${attemptNumber} — The student submitted this query:

\`\`\`sql
${sql}
\`\`\`

RESULT: ${errorContext}

Give coaching feedback following the rules. Remember: do NOT reveal the solution.`;
}
