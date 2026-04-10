# Backlog

## Multiple test cases per problem

Currently each problem has one test case (one data set, one expected output). LeetCode runs user SQL against multiple data sets to catch edge cases.

To implement:
- Each problem could define additional INSERT sets that test edge cases (empty tables, NULLs, ties, boundary values, large data)
- Run user's SQL against each data set, compare results
- Report X/N test cases passed, show the first failing case
- Could use LLM to generate edge-case data sets automatically
- UI shows "Test Case 1/3 Failed" with the specific failing input/output

## LLM-adaptive skill tree navigation

The skill tree defines a static prerequisite graph between categories. The next step is making it adaptive:

- When a student struggles with a category (multiple failures, low mastery), the AI coach suggests stepping back to a prerequisite or generating easier practice problems
- When a student masters a category, the coach suggests the next skill in the tree
- The LLM can generate additional problems targeting specific weak areas (using the existing problem generation pipeline)
- "Suggested next" could appear after solving a problem: "You've mastered Joins! Ready for Subqueries?" or "Struggling with Window Functions? Try reviewing Aggregation first."
- Builds on the existing coaching chat, problem generation, and mastery tracking systems
