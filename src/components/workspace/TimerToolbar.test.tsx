import { describe, expect, test, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import TimerToolbar from "./TimerToolbar";
import type { ProblemTimer } from "@/hooks/useProblemTimer";

function makeTimer(overrides: Partial<ProblemTimer> = {}): ProblemTimer {
  return {
    enabled: false,
    started: false,
    elapsedMs: 0,
    confirmingReset: false,
    toggle: mock(),
    beginTicking: mock(),
    stopTicking: mock(),
    reset: mock(),
    confirmReset: mock(),
    cancelReset: mock(),
    ...overrides,
  };
}

describe("TimerToolbar", () => {
  test("renders disabled Timer button by default", () => {
    const timer = makeTimer();
    const { getByTitle } = render(<TimerToolbar timer={timer} />);

    const button = getByTitle("Enable timer");
    expect(button.textContent).toContain("Timer");
    // Elapsed label should not be shown when disabled.
    expect(button.textContent).not.toContain("00:00");
  });

  test("renders enabled Timer with formatted elapsed", () => {
    const timer = makeTimer({
      enabled: true,
      started: true,
      elapsedMs: 95_000, // 1:35
    });
    const { getByTitle } = render(<TimerToolbar timer={timer} />);

    const button = getByTitle("Disable timer");
    expect(button.textContent).toContain("01:35");
  });

  test("click toggle calls timer.toggle()", () => {
    const timer = makeTimer();
    const { getByTitle } = render(<TimerToolbar timer={timer} />);

    fireEvent.click(getByTitle("Enable timer"));
    expect(timer.toggle).toHaveBeenCalledTimes(1);
  });

  test("confirming reset state renders inline Yes/No form", () => {
    const timer = makeTimer({
      enabled: true,
      started: true,
      elapsedMs: 154_000, // 2:34
      confirmingReset: true,
    });
    const { getByRole } = render(<TimerToolbar timer={timer} />);

    const group = getByRole("group", { name: /confirm timer reset/i });
    expect(group.textContent).toContain("Reset 02:34?");
    expect(getByRole("button", { name: /yes/i })).toBeDefined();
    expect(getByRole("button", { name: /no/i })).toBeDefined();
  });

  test("Yes button calls timer.confirmReset()", () => {
    const timer = makeTimer({
      enabled: true,
      started: true,
      elapsedMs: 60_000,
      confirmingReset: true,
    });
    const { getByRole } = render(<TimerToolbar timer={timer} />);

    fireEvent.click(getByRole("button", { name: /yes/i }));
    expect(timer.confirmReset).toHaveBeenCalledTimes(1);
    expect(timer.cancelReset).not.toHaveBeenCalled();
  });

  test("No button calls timer.cancelReset()", () => {
    const timer = makeTimer({
      enabled: true,
      started: true,
      elapsedMs: 60_000,
      confirmingReset: true,
    });
    const { getByRole } = render(<TimerToolbar timer={timer} />);

    fireEvent.click(getByRole("button", { name: /no/i }));
    expect(timer.cancelReset).toHaveBeenCalledTimes(1);
    expect(timer.confirmReset).not.toHaveBeenCalled();
  });
});
