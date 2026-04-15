import { describe, expect, test, beforeEach } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import NarrowViewportNotice from "./NarrowViewportNotice";

const DISMISS_KEY = "sql-coach:narrow-viewport-dismissed";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe("NarrowViewportNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setViewportWidth(1440);
  });

  test("renders nothing at 1280px or wider", () => {
    setViewportWidth(1440);
    const { container } = render(<NarrowViewportNotice />);
    expect(container.textContent).toBe("");
  });

  test("renders nothing exactly at 1280px", () => {
    setViewportWidth(1280);
    const { container } = render(<NarrowViewportNotice />);
    expect(container.textContent).toBe("");
  });

  test("renders the notice below 1280px", () => {
    setViewportWidth(1024);
    const { getByRole, getByText } = render(<NarrowViewportNotice />);

    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(getByText("Desktop optimized")).toBeDefined();
    expect(getByText(/SQL Coach is designed for 1280px\+/)).toBeDefined();
    expect(getByRole("button", { name: "Continue anyway" })).toBeDefined();
  });

  test("Continue anyway button persists dismissal to localStorage", () => {
    setViewportWidth(900);
    const { getByRole, container } = render(<NarrowViewportNotice />);

    fireEvent.click(getByRole("button", { name: "Continue anyway" }));

    expect(window.localStorage.getItem(DISMISS_KEY)).toBe("1");
    expect(container.textContent).toBe("");
  });

  test("notice stays hidden when localStorage already has dismissal", () => {
    setViewportWidth(800);
    window.localStorage.setItem(DISMISS_KEY, "1");
    const { container } = render(<NarrowViewportNotice />);
    expect(container.textContent).toBe("");
  });
});
