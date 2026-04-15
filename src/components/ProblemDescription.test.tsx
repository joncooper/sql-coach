import { describe, expect, test, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import ProblemDescription from "./ProblemDescription";

describe("ProblemDescription hint reveal", () => {
  test("renders Hints header with count when hints exist", () => {
    const { container } = render(
      <ProblemDescription
        description=""
        hints={["First hint", "Second hint", "Third hint"]}
      />
    );
    expect(container.textContent).toContain("Hints");
    expect(container.textContent).toContain("0/3");
  });

  test("nothing revealed initially", () => {
    const { container } = render(
      <ProblemDescription description="" hints={["Hint one", "Hint two"]} />
    );
    // No hint text is visible before reveal.
    expect(container.textContent).not.toContain("Hint one");
    expect(container.textContent).not.toContain("Hint two");
  });

  test("click Show next hint reveals the first hint with Revealed eyebrow", () => {
    const { container, getByRole } = render(
      <ProblemDescription description="" hints={["Alpha", "Beta", "Gamma"]} />
    );

    fireEvent.click(getByRole("button", { name: /show next hint/i }));

    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Revealed");
    // First reveal uses "just now" since formatRevealedAt returns it
    // when less than 1 minute has elapsed.
    expect(container.textContent).toContain("just now");
    // Counter updated.
    expect(container.textContent).toContain("1/3");
  });

  test("revealing all hints hides the Show next hint button", () => {
    const { container, queryByRole } = render(
      <ProblemDescription description="" hints={["A", "B"]} />
    );

    const first = queryByRole("button", { name: /show next hint/i });
    expect(first).not.toBeNull();
    fireEvent.click(first!);

    const second = queryByRole("button", { name: /show next hint/i });
    expect(second).not.toBeNull();
    fireEvent.click(second!);

    // All revealed — button gone.
    expect(queryByRole("button", { name: /show next hint/i })).toBeNull();
    expect(container.textContent).toContain("2/2");
  });

  test("onHintReveal callback fires with the count", () => {
    const onHintReveal = mock();
    const { getByRole } = render(
      <ProblemDescription
        description=""
        hints={["A", "B", "C"]}
        onHintReveal={onHintReveal}
      />
    );

    fireEvent.click(getByRole("button", { name: /show next hint/i }));
    fireEvent.click(getByRole("button", { name: /show next hint/i }));

    expect(onHintReveal).toHaveBeenCalledTimes(2);
    expect(onHintReveal.mock.calls[0][0]).toBe(1);
    expect(onHintReveal.mock.calls[1][0]).toBe(2);
  });

  test("canShowSolution shows the Show solution button", () => {
    const onShowSolution = mock();
    const { getByRole } = render(
      <ProblemDescription
        description=""
        hints={[]}
        canShowSolution
        onShowSolution={onShowSolution}
      />
    );

    const button = getByRole("button", { name: "Show solution" });
    fireEvent.click(button);
    expect(onShowSolution).toHaveBeenCalledTimes(1);
  });

  test("solution renders when provided", () => {
    const { container } = render(
      <ProblemDescription
        description=""
        hints={[]}
        solution="SELECT * FROM users;"
      />
    );
    expect(container.textContent).toContain("Solution");
    expect(container.textContent).toContain("SELECT * FROM users;");
  });
});
