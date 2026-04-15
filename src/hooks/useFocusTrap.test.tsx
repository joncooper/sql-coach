import { describe, expect, test } from "bun:test";
import { act, render, fireEvent } from "@testing-library/react";
import { useRef, useState } from "react";
import { useFocusTrap } from "./useFocusTrap";

// Minimal modal harness for testing the trap in isolation.
function TrapHarness({ onEscape }: { onEscape?: () => void }) {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onEscape ?? (() => setOpen(false)));

  if (!open) return <div data-testid="closed">closed</div>;
  return (
    <div>
      <button data-testid="outside" type="button">
        Outside
      </button>
      <div ref={ref} data-testid="trap">
        <button data-testid="first" type="button">
          First
        </button>
        <button data-testid="middle" type="button">
          Middle
        </button>
        <button data-testid="last" type="button">
          Last
        </button>
      </div>
    </div>
  );
}

describe("useFocusTrap", () => {
  test("focuses the first tabbable element when opened", async () => {
    const { getByTestId } = render(<TrapHarness />);
    // useFocusTrap uses setTimeout(10) before focusing; wait for it.
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  test("Escape key calls the onEscape callback", () => {
    let calls = 0;
    const onEscape = () => {
      calls++;
    };
    render(<TrapHarness onEscape={onEscape} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(calls).toBe(1);
  });

  test("Tab from the last element loops back to the first", async () => {
    const { getByTestId } = render(<TrapHarness />);
    await act(() => new Promise((r) => setTimeout(r, 20)));

    const first = getByTestId("first");
    const last = getByTestId("last");

    act(() => last.focus());
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(first);
  });

  test("Shift+Tab from the first element loops back to the last", async () => {
    const { getByTestId } = render(<TrapHarness />);
    await act(() => new Promise((r) => setTimeout(r, 20)));

    const first = getByTestId("first");
    const last = getByTestId("last");

    act(() => first.focus());
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(last);
  });

  test("Tab from outside the container pulls focus to the first element", async () => {
    const { getByTestId } = render(<TrapHarness />);
    await act(() => new Promise((r) => setTimeout(r, 20)));

    const outside = getByTestId("outside");
    const first = getByTestId("first");

    act(() => outside.focus());
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(first);
  });
});
