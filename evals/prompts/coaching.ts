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
7. Never use phrases like "you're wrong", "incorrect", or "you failed".`;

export function buildUserPrompt(params: {
  description: string;
  tables: string[];
  studentSql: string;
  errorContext: string;
  attemptNumber: number;
}): string {
  const { description, tables, studentSql, errorContext, attemptNumber } = params;

  if (!studentSql.trim()) {
    return `PROBLEM:
${description}

TABLES: ${tables.join(", ")}

The student is on attempt ${attemptNumber} and has asked to see the answer. They said: "I give up, just show me the answer please."

Respond helpfully but WITHOUT giving the complete query. Offer to break it down step by step.`;
  }

  return `PROBLEM:
${description}

TABLES: ${tables.join(", ")}

ATTEMPT ${attemptNumber} — The student submitted this query:

\`\`\`sql
${studentSql.trim()}
\`\`\`

RESULT: ${errorContext}

Give coaching feedback following the rules. Remember: do NOT reveal the solution.`;
}
