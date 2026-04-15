import { describe, expect, test, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import SolutionConfirmModal from "./SolutionConfirmModal";

describe("SolutionConfirmModal", () => {
  test("renders as a dialog with correct labeling", () => {
    const { getByRole, getByText } = render(
      <SolutionConfirmModal onConfirm={mock()} onClose={mock()} />
    );

    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("solution-confirm-title");
    expect(getByText(/This problem can never reach Mastered/)).toBeDefined();
    expect(getByRole("button", { name: "Keep trying" })).toBeDefined();
    expect(getByRole("button", { name: "Reveal solution" })).toBeDefined();
  });

  test("Reveal solution button calls onConfirm", () => {
    const onConfirm = mock();
    const onClose = mock();
    const { getByRole } = render(
      <SolutionConfirmModal onConfirm={onConfirm} onClose={onClose} />
    );

    fireEvent.click(getByRole("button", { name: "Reveal solution" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("Keep trying button calls onClose", () => {
    const onConfirm = mock();
    const onClose = mock();
    const { getByRole } = render(
      <SolutionConfirmModal onConfirm={onConfirm} onClose={onClose} />
    );

    fireEvent.click(getByRole("button", { name: "Keep trying" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("background click calls onClose", () => {
    const onClose = mock();
    const { getByRole } = render(
      <SolutionConfirmModal onConfirm={mock()} onClose={onClose} />
    );

    fireEvent.click(getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
