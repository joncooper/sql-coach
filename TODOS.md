# TODOs

Design and engineering debt captured during `/plan-design-review` on 2026-04-15. Each item links back to specific files and the review's rationale.

Format: `- [ ] **Title** — what / why / where (status)`

## Design debt from /plan-design-review 2026-04-15

### Already shipped in this review
- [x] **Token consolidation** — `globals.css` updated: `--positive` → `#10b981`, `--danger` → `#ef4444`, `--warning` + `--highlight` collapsed to `#f59e0b` (single amber). Values now match DESIGN.md.
- [x] **Shadows removed** — Stripped `box-shadow` from `.app-panel`, `.app-panel-strong`, `.btn-primary`. Deleted `--shadow` / `--shadow-soft` / `--shadow-lift` token definitions. Depth is border-only per DESIGN.md rule of thumb.
- [x] **Streak glow de-ambered** — `@keyframes streak-glow` no longer uses amber drop-shadow (was a violation of "amber is overdue only"). Now a subtle brightness pulse.
- [x] **`prefers-reduced-motion` guard** — added global media query disabling `.animate-in`, `.animate-streak-pulse`, `.animate-streak-glow`, `.animate-reveal`, and transitions.
- [x] **DESIGN.md §Problem workspace** — added the missing spec section covering left-panel three-zone IA, editor chrome, results panel, accepted celebration, state matrix, a11y requirements.
- [x] **Search stub cut** — `TopNav.tsx`. The hidden non-functional search input with ⌘K hint was removed entirely. Re-implement real Cmd-K search as a new feature when needed, not as a stub.
- [x] **Hardcoded "YC" avatar replaced** — `TopNav.tsx`. Was identity theater. Now renders an honest `solo` ring pill since stats are localStorage-only.
- [x] **Catalog right-rail Today's Focus cut** — `CatalogMode.tsx`. The duplicative coach-pick panel in the right rail was removed; `At a glance` stats + `Coach mode` cross-link remain (they earn their pixels).
- [x] **Activity chart non-color differentiation** — `CoachMode.tsx`. Active days now have a 2px `--accent-strong` top border so the signal survives colorblind modes.
- [x] **Subsequent-pass celebration banner** — `problems/[slug]/page.tsx`. Submits after the first solve now show a 3-second inline `✓ Accepted · Nms · N attempts` banner above the results table instead of the full Accepted modal.
- [x] **Skeleton rows for results table** — `ResultsTable.tsx`. New `isLoading` prop renders 3 monospace skeleton rows matching the real chrome so layout doesn't jump during `Run query`. Wired via `isLoading={isRunning && !result && !error}`.
- [x] **Analysis-pending surface in results panel** — `problems/[slug]/page.tsx`. Failed-submit now renders an inline `COACH ANALYZING · ~Ns` eyebrow row above the diff with an `Open coach chat →` button. Clears when coach chat opens.
- [x] **Coach engine error state on home** — `src/app/page.tsx`. `pickNextProblem` is wrapped in try/catch; thrown errors render a fallback panel with `Browse catalog` + `Reset progress` buttons instead of blanking the page.
- [x] **Catalog empty-filters state** — `CatalogMode.tsx`. When filters resolve to zero problems, renders a centered `No problems match those filters` eyebrow + `Clear filters` ghost button.
- [x] **Solution reveal branded modal** — `problems/[slug]/page.tsx`. `window.confirm()` replaced with `app-panel-strong` modal: *"This problem can never reach Mastered."* eyebrow + prose + `Reveal solution` (destructive red) / `Keep trying` (ghost) buttons. Escape closes, aria-modal, aria-labelledby.
- [x] **Timer reset inline confirm** — `problems/[slug]/page.tsx`. Clicking the timer when elapsed > 0 now swaps the button for an inline `Reset 02:34? Yes / No` form. No elapsed time = direct toggle, no friction.
- [x] **Hint read-state** — `ProblemDescription.tsx`. Each revealed hint now shows a small `✓ Revealed` eyebrow in `--positive` with a `just now / Xm ago / Xh ago` timestamp, so re-reading feels cheap.
- [x] **Narrow-viewport notice** — new `NarrowViewportNotice` component mounted in `layout.tsx`. Checks `window.innerWidth < 1280` on mount and renders a one-time `app-panel-strong` modal with `Continue anyway` button. Dismissal is remembered in localStorage.
- [x] **Skip-to-content link** — `TopNav.tsx` has `<a href="#main">` with `sr-only focus:not-sr-only` classes. `layout.tsx` wraps children in `<main id="main">` so the target exists.
- [x] **`--text-faint` content audit** — 3 content usages replaced with `--text-muted` in `ProblemDescription.tsx` (hint count + hint number) and `MasteryIndicator.tsx` (unattempted state). `--text-faint` remains for decorative strokes only.
- [x] **Accepted modal focus trap + `aria-modal`** — `problems/[slug]/page.tsx`. Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby="accepted-eyebrow"`, Escape-to-close via `useEffect`, focus lands on primary button (Next problem if it exists, else Keep editing), focus returns to trigger on close. Also added a `Return to Coach` button to the modal.
- [x] **`pill-medium` contrast fix** — `globals.css`. Added `--warning-text: #b45309` (darker amber, 5.3:1 on `--warning-soft`, passes AA). `.pill-medium` + the due-for-review banner + the timer active pill + the coaching-failure banner all updated to use `--warning-text` instead of `--warning`.

### Already shipped in /plan-eng-review refactor pass

- [x] **Extracted `problems/[slug]/page.tsx` god component** — created `useProblemTimer`, `useFocusTrap`, `AcceptedModal`, `SolutionConfirmModal`, `TimerToolbar`. Page size dropped from 1083 lines (peak during TODO fixes) to 835 lines. Net smaller than when the session started.
- [x] **Real focus trap in modals** — `useFocusTrap` hook handles Tab/Shift+Tab loop, initial focus, Escape, focus return. Previous implementation only handled initial focus + Escape; Tab could escape to background.
- [x] **Celebration banner timer leak fixed** — moved `setTimeout` into a `useEffect` with cleanup so navigating away mid-3s doesn't warn about setState on unmounted.
- [x] **Pending analysis stale timestamp removed** — the `~Ns` counter was frozen at render time. Replaced with animated pulse dots `Coach analyzing…` so the sense of motion comes from CSS, not from lying about seconds elapsed.
- [x] **`formatElapsed` DRY fix** — was duplicated in `page.tsx` and `TimerToolbar.tsx`. Extracted to `src/lib/formatTime.ts` alongside `formatRevealedAt` (also pure). 13 new unit tests: `formatElapsed` zero/pad/rollover/multi-digit/negative/truncate, `formatRevealedAt` just-now/mins/hours/days/future/default-now.
- [x] **Unused imports cleaned up** — removed `useRef`, `formatMastery`, `masteryLabels` from `page.tsx` after extraction.

### Shipped in the 2026-04-15 cleanup pass

- [x] **Component test infrastructure** — Added `@happy-dom/global-registrator` + `@testing-library/react` + `@testing-library/dom` + `@testing-library/user-event` as dev deps. Happy-dom is registered via `test/setup.ts` preloaded from `bunfig.toml`. Single runner (`bun test`) covers both pure lib tests and DOM tests. `tsconfig.json` excludes `test/` and `**/*.test.{ts,tsx}` so Next.js doesn't type-check `bun:test` imports.
- [x] **Component test coverage** — Wrote 56 new tests across 8 files: `TimerToolbar` (6), `useProblemTimer` (10), `useFocusTrap` (5), `AcceptedModal` (11), `SolutionConfirmModal` (4), `NarrowViewportNotice` (5), `ResultsTable` (8), `ProblemDescription` (7). Full suite is now **145 tests across 15 files, all green in ~350ms**.
- [x] **`--text-faint` token deleted** — Had zero code consumers after the content audit. Removed from `globals.css` and `DESIGN.md`. Prevents future authors from reaching for a 2.85:1 contrast regression.

### Still to do

_Nothing from this review cycle. Repo is clean._

## Notes

- Review log: `~/.gstack/projects/joncooper-sql-coach/` (via `gstack-review-read`)
- Approved workspace mockups: `~/.gstack/projects/joncooper-sql-coach/designs/workspace-20260415/approved.json`
- Full review conversation lives in the session that created these TODOs; re-run `/plan-design-review` to refresh ratings after implementation.
