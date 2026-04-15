/**
 * Bun test DOM setup.
 *
 * Loaded via bunfig.toml [test] preload. Registers happy-dom as the
 * global DOM so React Testing Library can render components inside
 * `bun test`. This keeps a single test runner for the whole project
 * (pure lib tests in src/lib + component tests in src/components,
 * src/hooks, src/app).
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

GlobalRegistrator.register({ url: "http://localhost:3000/" });

// Clean up rendered trees between tests so queries don't leak.
afterEach(() => {
  cleanup();
});
