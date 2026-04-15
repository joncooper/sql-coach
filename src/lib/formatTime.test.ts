import { describe, expect, test } from "bun:test";
import { formatElapsed, formatRevealedAt } from "./formatTime";

describe("formatElapsed", () => {
  test("renders zero as 00:00", () => {
    expect(formatElapsed(0)).toBe("00:00");
  });

  test("pads single-digit seconds", () => {
    expect(formatElapsed(9_000)).toBe("00:09");
  });

  test("renders minutes and seconds", () => {
    expect(formatElapsed(65_000)).toBe("01:05");
  });

  test("rolls to multi-digit minutes", () => {
    expect(formatElapsed(10 * 60 * 1000 + 7 * 1000)).toBe("10:07");
  });

  test("caps minutes above 60 (no hour rollover)", () => {
    expect(formatElapsed(125 * 60 * 1000)).toBe("125:00");
  });

  test("coerces negative input to zero (defensive)", () => {
    expect(formatElapsed(-500)).toBe("00:00");
  });

  test("truncates sub-second values down", () => {
    expect(formatElapsed(2_999)).toBe("00:02");
  });
});

describe("formatRevealedAt", () => {
  const T0 = 1_776_000_000_000; // arbitrary fixed "now"

  test("just revealed → 'just now'", () => {
    expect(formatRevealedAt(T0, T0)).toBe("just now");
    expect(formatRevealedAt(T0 - 30_000, T0)).toBe("just now");
  });

  test("under an hour → 'Xm ago'", () => {
    expect(formatRevealedAt(T0 - 60_000, T0)).toBe("1m ago");
    expect(formatRevealedAt(T0 - 15 * 60_000, T0)).toBe("15m ago");
    expect(formatRevealedAt(T0 - 59 * 60_000, T0)).toBe("59m ago");
  });

  test("1 to 23 hours → 'Xh ago'", () => {
    expect(formatRevealedAt(T0 - 60 * 60_000, T0)).toBe("1h ago");
    expect(formatRevealedAt(T0 - 5 * 60 * 60_000, T0)).toBe("5h ago");
    expect(formatRevealedAt(T0 - 23 * 60 * 60_000, T0)).toBe("23h ago");
  });

  test("24+ hours → 'Xd ago'", () => {
    expect(formatRevealedAt(T0 - 24 * 60 * 60_000, T0)).toBe("1d ago");
    expect(formatRevealedAt(T0 - 7 * 24 * 60 * 60_000, T0)).toBe("7d ago");
  });

  test("future timestamps clamp to 'just now'", () => {
    expect(formatRevealedAt(T0 + 5_000, T0)).toBe("just now");
  });

  test("uses Date.now() when no `now` is passed", () => {
    // Just assert it returns a string in the expected shape.
    const label = formatRevealedAt(Date.now() - 10 * 60_000);
    expect(label).toBe("10m ago");
  });
});
