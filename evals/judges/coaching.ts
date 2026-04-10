import type { CriterionResult, CoachingFixture } from "../types.ts";

const DISCOURAGING_PHRASES = [
  "you're wrong",
  "you are wrong",
  "incorrect",
  "you failed",
  "that's wrong",
  "that is wrong",
  "bad attempt",
  "terrible",
  "awful",
  "stupid",
  "incompetent",
];

function normalizeSQL(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")    // strip comments
    .replace(/\s+/g, " ")      // collapse whitespace
    .replace(/;/g, "")         // strip semicolons
    .trim()
    .toLowerCase();
}

/** Extract substantive lines from solution (>20 chars, not just keywords) */
function getSubstantiveFragments(solution: string): string[] {
  const keywordsOnly = /^\s*(select|from|where|order\s+by|group\s+by|having|and|or|on|join|left|right|inner|as|limit|offset|asc|desc|,)\s*$/i;

  return solution
    .split("\n")
    .map((line) => line.replace(/--.*$/, "").trim())
    .filter((line) => line.length > 20 && !keywordsOnly.test(line))
    .map((line) => normalizeSQL(line));
}

export function judgeCoaching(
  response: string,
  fixture: CoachingFixture,
  solutionSql: string
): CriterionResult[] {
  const criteria: CriterionResult[] = [];
  const responseLower = response.toLowerCase();
  const responseNorm = normalizeSQL(response);

  // 1. no_spoiler — response must NOT contain the solution
  const solutionNorm = normalizeSQL(solutionSql);
  const fragments = getSubstantiveFragments(solutionSql);

  let spoilerFound: string | null = null;

  // Check if the full solution appears
  if (responseNorm.includes(solutionNorm)) {
    spoilerFound = "contains full solution SQL";
  }

  // Check for substantive fragments (any 2+ fragments = likely giving it away)
  if (!spoilerFound) {
    const matchedFragments = fragments.filter((f) => responseNorm.includes(f));
    if (matchedFragments.length >= 2) {
      spoilerFound = `contains ${matchedFragments.length} solution fragments`;
    }
  }

  criteria.push({
    name: "no_spoiler",
    pass: spoilerFound === null,
    detail: spoilerFound ?? undefined,
  });

  // 2. concise — under word limit
  const wordCount = response.split(/\s+/).filter(Boolean).length;
  criteria.push({
    name: "concise",
    pass: wordCount <= fixture.rubric.max_words,
    detail: `${wordCount} words (limit: ${fixture.rubric.max_words})`,
  });

  // 3. mentions_issue — contains at least one should_mention keyword
  const mentionMatches = fixture.rubric.should_mention.filter((kw) =>
    responseLower.includes(kw.toLowerCase())
  );
  criteria.push({
    name: "mentions_issue",
    pass: mentionMatches.length > 0,
    detail:
      mentionMatches.length > 0
        ? `matched: ${mentionMatches.join(", ")}`
        : `none of [${fixture.rubric.should_mention.join(", ")}] found`,
  });

  // 4. acknowledges_correct — mentions something the student got right
  if (fixture.rubric.should_acknowledge_correct.length === 0) {
    // For cases like "asks-for-answer" where there's nothing to acknowledge
    criteria.push({
      name: "acknowledges_correct",
      pass: true,
      detail: "no acknowledgment expected (student didn't submit SQL)",
    });
  } else {
    const ackMatches = fixture.rubric.should_acknowledge_correct.filter((kw) =>
      responseLower.includes(kw.toLowerCase())
    );
    criteria.push({
      name: "acknowledges_correct",
      pass: ackMatches.length > 0,
      detail:
        ackMatches.length > 0
          ? `matched: ${ackMatches.join(", ")}`
          : `none of [${fixture.rubric.should_acknowledge_correct.join(", ")}] found`,
    });
  }

  // 5. not_discouraging — no harsh language
  const discouragingMatch = DISCOURAGING_PHRASES.find((phrase) =>
    responseLower.includes(phrase)
  );
  criteria.push({
    name: "not_discouraging",
    pass: !discouragingMatch,
    detail: discouragingMatch ? `contains "${discouragingMatch}"` : undefined,
  });

  return criteria;
}
