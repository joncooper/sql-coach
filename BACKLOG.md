# Backlog

## Multiple test cases per problem

Currently each problem has one test case (one data set, one expected output). LeetCode runs user SQL against multiple data sets to catch edge cases.

To implement:
- Each problem could define additional INSERT sets that test edge cases (empty tables, NULLs, ties, boundary values, large data)
- Run user's SQL against each data set, compare results
- Report X/N test cases passed, show the first failing case
- Could use LLM to generate edge-case data sets automatically
- UI shows "Test Case 1/3 Failed" with the specific failing input/output
