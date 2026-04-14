// Proven problem generation prompts — validated by eval harness (7/7 score).
// Source of truth: evals/prompts/problem-gen.ts

export const SYSTEM_PROMPT = `You are a SQL practice problem author for a PostgreSQL coaching tool aimed at people preparing for SQL interviews.

Your job is to create BOTH a database schema (with sample data) AND a practice problem. You must invent a realistic domain — NOT hr, ecommerce, or analytics (those already exist in the system).

Return a JSON object with this exact structure:
{
  "schema_name": "lowercase_single_word",
  "ddl": "CREATE SCHEMA IF NOT EXISTS ...; CREATE TABLE ... (with constraints);",
  "seed_data": "INSERT INTO ... statements with 8-15 rows per table",
  "problem": {
    "slug": "kebab-case-name",
    "title": "Human Readable Title",
    "difficulty": "easy|medium|hard",
    "category": "one string from: basics, joins, subqueries, aggregation, window-functions, ctes, advanced",
    "tags": ["relevant", "sql", "concepts"],
    "domain": "same as schema_name",
    "tables": ["schema_name.table1", "schema_name.table2"],
    "description": "Clear problem description with **bold** for emphasis. Specify exact column names to return and ordering.",
    "hints": ["First hint - gentle nudge", "Second hint - more specific", "Third hint - nearly gives it away"],
    "order_matters": true,
    "solution": "Complete working PostgreSQL SQL",
    "expected_columns": ["col1", "col2"]
  }
}

Do NOT include a "starter_code" field. The editor always starts blank.

Rules:
- schema_name must be a single lowercase word (no hyphens or spaces)
- All table references in ddl, seed_data, and solution MUST use schema_name.table_name format
- category MUST be a single string, NOT an array
- difficulty MUST be exactly "easy", "medium", or "hard"
- hints MUST have at least 2 entries, progressing from vague to specific
- hints MUST NOT contain the full solution SQL
- solution MUST be valid PostgreSQL syntax
- The seed data must have enough rows to make the problem non-trivial
- Tables should have realistic relationships (foreign keys)
- The problem should test a specific SQL concept that's relevant to interviews`;

const DOMAINS = [
  { domain: "a library book lending system", tables: "books, authors, loans, members" },
  { domain: "a hospital patient records system", tables: "patients, doctors, appointments, prescriptions" },
  { domain: "a music streaming service", tables: "artists, albums, tracks, listens" },
  { domain: "a university course enrollment system", tables: "students, courses, enrollments, professors" },
  { domain: "a restaurant reservation system", tables: "restaurants, tables, reservations, reviews" },
  { domain: "a real estate listing platform", tables: "properties, agents, viewings, offers" },
  { domain: "a fitness tracking application", tables: "users, workouts, exercises, records" },
  { domain: "a project management tool", tables: "projects, tasks, team_members, assignments" },
];

const CONCEPTS = [
  "JOINs (inner, left, self-join)",
  "GROUP BY with HAVING",
  "window functions (RANK, ROW_NUMBER, LAG/LEAD)",
  "CTEs (WITH clauses)",
  "subqueries (correlated and uncorrelated)",
  "date arithmetic and DATE_TRUNC",
  "CASE expressions with aggregation",
  "set operations (UNION, EXCEPT, INTERSECT)",
];

export function buildUserPrompt(params: {
  difficulty?: "easy" | "medium" | "hard";
  topic?: string;
}): string {
  const difficulty = params.difficulty ?? "medium";

  if (params.topic?.trim()) {
    const concept = CONCEPTS[Math.floor(Math.random() * CONCEPTS.length)];
    return `Generate a ${difficulty} SQL practice problem about ${params.topic.trim()}. The problem should test: ${concept}. Include realistic seed data with 8-15 rows per table.`;
  }

  const domainInfo = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const concept = CONCEPTS[Math.floor(Math.random() * CONCEPTS.length)];

  return `Generate a ${difficulty} SQL practice problem about ${domainInfo.domain}. The schema might include tables like: ${domainInfo.tables}. The problem should test: ${concept}. Include realistic seed data with 8-15 rows per table.`;
}
