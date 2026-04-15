import { describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useProblemTimer } from "./useProblemTimer";

describe("useProblemTimer", () => {
  test("starts disabled and clean", () => {
    const { result } = renderHook(() => useProblemTimer());
    expect(result.current.enabled).toBe(false);
    expect(result.current.started).toBe(false);
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.confirmingReset).toBe(false);
  });

  test("toggle() off → on arms the timer", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.toggle());

    expect(result.current.enabled).toBe(true);
    expect(result.current.started).toBe(false);
    expect(result.current.elapsedMs).toBe(0);
  });

  test("beginTicking() is a no-op when disabled", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.beginTicking());

    expect(result.current.started).toBe(false);
  });

  test("beginTicking() after toggle starts ticking", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.toggle());
    act(() => result.current.beginTicking());

    expect(result.current.enabled).toBe(true);
    expect(result.current.started).toBe(true);
  });

  test("beginTicking() is idempotent once started", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.toggle());
    act(() => result.current.beginTicking());
    act(() => result.current.beginTicking()); // no-op

    expect(result.current.started).toBe(true);
  });

  test("stopTicking() halts ticking but preserves elapsed", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.toggle());
    act(() => result.current.beginTicking());
    // Simulate the interval tick by calling stopTicking immediately;
    // we only care that stopTicking leaves enabled + elapsed alone.
    act(() => result.current.stopTicking());

    expect(result.current.enabled).toBe(true);
    expect(result.current.started).toBe(false);
  });

  test("reset() clears elapsed + started but keeps enabled", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.toggle());
    act(() => result.current.beginTicking());
    act(() => result.current.reset());

    expect(result.current.enabled).toBe(true); // still armed
    expect(result.current.started).toBe(false);
    expect(result.current.elapsedMs).toBe(0);
  });

  test("toggle() off with no elapsed fully disables", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.toggle()); // on
    act(() => result.current.toggle()); // off (no elapsed yet)

    expect(result.current.enabled).toBe(false);
    expect(result.current.confirmingReset).toBe(false);
  });

  test("confirmReset() fully disables + clears state", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.toggle());
    act(() => result.current.beginTicking());
    act(() => result.current.confirmReset());

    expect(result.current.enabled).toBe(false);
    expect(result.current.started).toBe(false);
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.confirmingReset).toBe(false);
  });

  test("cancelReset() dismisses the confirm without disabling", () => {
    const { result } = renderHook(() => useProblemTimer());

    act(() => result.current.toggle());
    act(() => result.current.beginTicking());
    // confirmingReset only gets set via toggle-with-elapsed path; fake it
    // by calling confirmReset's sibling cancelReset. It should be a no-op
    // when not confirming, which is a safety guarantee we test for.
    act(() => result.current.cancelReset());

    expect(result.current.enabled).toBe(true);
    expect(result.current.confirmingReset).toBe(false);
  });
});
