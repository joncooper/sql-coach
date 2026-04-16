import { describe, expect, test, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import AcceptedModal from "./AcceptedModal";
import type { NextResult } from "@/lib/problem-navigation";

const NEXT: NextResult = { kind: "next", slug: "second-highest-salary" };
const DONE: NextResult = { kind: "end-of-catalog", slug: null };

describe("AcceptedModal", () => {
  test("renders the core fields", () => {
    const { getByText, getByRole } = render(
      <AcceptedModal
        executionTimeMs={34}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={null}
        totalSolved={5}
        nextResult={NEXT}
        onClose={mock()}
      />
    );

    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("accepted-eyebrow");
    expect(getByText("Accepted")).toBeDefined();
    expect(getByText("Clean pass.")).toBeDefined();
    expect(dialog.textContent).toContain("Runtime 34ms");
    expect(dialog.textContent).toContain("5 total solved");
  });

  test("elapsedLabel renders when provided", () => {
    const { getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel="03:27"
        attemptCount={1}
        masteryTransition={null}
        totalSolved={0}
        nextResult={DONE}
        onClose={mock()}
      />
    );
    expect(getByText(/Time 03:27/)).toBeDefined();
  });

  test("attempt count > 1 shows 'Solved in N attempts'", () => {
    const { getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={4}
        masteryTransition={null}
        totalSolved={0}
        nextResult={DONE}
        onClose={mock()}
      />
    );
    expect(getByText("Solved in 4 attempts")).toBeDefined();
  });

  test("mastery transition from 'solved' shows the arrow", () => {
    const { getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={{ from: "solved", to: "practiced" }}
        totalSolved={0}
        nextResult={DONE}
        onClose={mock()}
      />
    );
    expect(getByText(/Solved → Practiced/)).toBeDefined();
  });

  test("mastery transition from 'attempted' hides the 'from' label", () => {
    const { queryByText, getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={{ from: "attempted", to: "solved" }}
        totalSolved={0}
        nextResult={DONE}
        onClose={mock()}
      />
    );
    expect(getByText("Solved")).toBeDefined();
    expect(queryByText(/Attempted →/)).toBeNull();
  });

  test("Next problem button renders when nextResult is kind 'next'", () => {
    const { getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={null}
        totalSolved={0}
        nextResult={{ kind: "next", slug: "my-next-problem" }}
        onClose={mock()}
      />
    );
    const next = getByText("Next problem") as HTMLAnchorElement;
    expect(next.getAttribute("href")).toBe("/problems/my-next-problem");
  });

  test("Next problem button absent when kind is 'end-of-catalog'", () => {
    const { queryByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={null}
        totalSolved={0}
        nextResult={DONE}
        onClose={mock()}
      />
    );
    expect(queryByText("Next problem")).toBeNull();
  });

  test("end-of-filter with nextSectionSlug shows 'Continue to next section' button", () => {
    const { getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={null}
        totalSolved={0}
        nextResult={{
          kind: "end-of-filter",
          slug: null,
          filterLabel: "Medium · Joins",
          nextSectionSlug: "agg-1",
          nextSectionLabel: "Aggregation",
        }}
        onClose={mock()}
      />
    );
    expect(getByText(/You've cleared Medium · Joins/)).toBeDefined();
    expect(getByText(/Continue to Aggregation/)).toBeDefined();
    const cta = getByText("Continue to next section") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe("/problems/agg-1");
  });

  test("end-of-filter with no next section hides the primary CTA", () => {
    const { queryByText, getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={null}
        totalSolved={0}
        nextResult={{
          kind: "end-of-filter",
          slug: null,
          filterLabel: "Hard",
          nextSectionSlug: null,
          nextSectionLabel: null,
        }}
        onClose={mock()}
      />
    );
    expect(getByText(/You've cleared Hard/)).toBeDefined();
    expect(queryByText("Next problem")).toBeNull();
    expect(queryByText("Continue to next section")).toBeNull();
  });

  test("Return to Coach button links to home", () => {
    const { getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={null}
        totalSolved={0}
        nextResult={DONE}
        onClose={mock()}
      />
    );
    const link = getByText("Return to Coach") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/");
  });

  test("Keep editing button calls onClose", () => {
    const onClose = mock();
    const { getByText } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={null}
        totalSolved={0}
        nextResult={DONE}
        onClose={onClose}
      />
    );
    fireEvent.click(getByText("Keep editing"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("background click calls onClose", () => {
    const onClose = mock();
    const { getByRole } = render(
      <AcceptedModal
        executionTimeMs={12}
        elapsedLabel={null}
        attemptCount={1}
        masteryTransition={null}
        totalSolved={0}
        nextResult={DONE}
        onClose={onClose}
      />
    );
    fireEvent.click(getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
