# Design System

Source of truth for SQL Coach visual and product direction. Locked in via `/design-shotgun` on 2026-04-13 after three rounds of variant exploration. See `~/.gstack/projects/joncooper-sql-coach/designs/home-problem-list-20260413/` for the approved mockups and round history.

## Product model

Two modes, toggled via a segmented control in the top nav:

- **Coach** — AI-driven. One recommended next problem at a time, plus an expandable "Why I picked this" panel showing mastery scores, candidate pool, and learning path. The AI's thinking is legible and one click away.
- **Catalog** — Self-directed. Dense, sortable problem table with left skill-tree sidebar and right-rail Today's Focus card.

Both modes share the same nav, type, color, and spacing vocabulary. They differ only in body layout.

## Mood

Adult, professional, calm. Linear × Notion × Raycast. Not Duolingo, not gamified, not a dashboard blown up with AI glow effects. The AI is present but restrained — it shows its reasoning, it doesn't perform confidence.

## Color

All hex values are the intended design-system values, not auto-extracted approximations.

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#f8fafc` | page background |
| `surface` | `#ffffff` | cards, panels |
| `border` | `#e2e8f0` | 1px borders on all cards and dividers |
| `text` | `#0f172a` | primary text, headings |
| `text-muted` | `#64748b` | secondary text, labels, small caps |
| `accent` | `#4f46e5` | CTAs, mastery bars, Coach toggle active state, streak ring fill |
| `warn` | `#f59e0b` | review-due dot, overdue indicators — used sparingly |
| `success` | `#10b981` | correct-attempt ticks in history |
| `danger` | `#ef4444` | missed-attempt marks in history |

No gradients. No drop shadows. Depth comes from the `border` token, not elevation.

## Typography

- **UI + body:** Inter
- **Numeric values, mastery scores, timestamps, monospace lists:** IBM Plex Mono
- Base size 14px
- Section labels: 11px Inter uppercase, `text-muted`, tracked (`SMALL CAPS` style via `letter-spacing`)
- Headings: Inter semibold, 16–32px depending on role
- Problem titles on Coach mode hero: Inter semibold 28–32px

No serif. No Fraunces, no decorative display faces.

## Spacing

- 4px base unit
- Card padding: 24px
- Section gaps: 24–32px
- Row density inside dense panels (mastery bars, candidate pool): 8–12px

## Radius

- 8px on all cards, panels, buttons, pills
- Pills and tags: 6px

## Component vocabulary

### Top nav (shared)
SQL Coach logo (left) · Coach/Catalog segmented toggle · Cmd-K search · small streak pill (flame icon + "N days") · avatar

### Difficulty pills
Easy = subtle green, Medium = amber, Hard = red. Lowercase text, small radius.

### Category tag
Gray rounded pill with `text-muted` label, e.g. "Basic SELECT".

### Coach mode — Today hero card
- Bordered surface, 24px padding
- Category tag + difficulty pill
- Problem title in Inter semibold 28–32px
- One-line italic coach note in regular Inter (e.g. *"Reinforces LEFT JOIN null handling from your last miss 3 days ago"*)
- Primary `Start problem` button in accent indigo
- Secondary `Skip` / `Pick different` as text links
- Right-side stats cluster: small mastery ring + "Due for review: N" with amber dot

### Coach mode — "Why I picked this" (collapsed)
- Single-row horizontal bar directly below the Today hero
- Info icon · label "Why I picked this" · one-line italic teaser in `text-muted` (e.g. *"Picked because you missed LEFT JOIN nullability 3 days ago"*) · chevron-right
- Expands to reveal full reasoning panel (see below)

### Coach mode — "Why I picked this" (expanded)
Four subsections, each with a small-caps label:
1. **MASTERY SCORES** — horizontal bars per concept with monospace numeric values on the right. Weak/weakest concepts get muted tag labels.
2. **REVIEW QUEUE** — one-line summary ("3 problems overdue, oldest 4 days past review") with a small amber dot.
3. **CANDIDATE POOL** — tight 5-row list of problems the AI considered. Each row: title · status tag (`CHOSEN` in accent, `SKIPPED` / `HELD` in muted gray) · one-line reason.
4. **LEARNING PATH** — small horizontal dot-and-line diagram showing user position between adjacent skill nodes.

### Catalog mode — body
- Left sidebar (240px): skill tree grouped into Fundamentals / Analytics / Logic / Applied with progress bars per category.
- Center: dense sortable problem table. Columns: `#`, Title, Difficulty, Category, Acceptance %, Mastery (small progress ring), Starred toggle. 14px type, tight line-height.
- Right rail (280px): single Today's Focus card with Your next problem CTA, plus compact Solved / Attempted / Review stats block.

### This week block (shared)
Small caps label + 7-day horizontal bar chart of activity minutes + two mini cards side-by-side (`Continue working`, `Starred`) with a few problem rows each.

## Rules of thumb

- **Never write your-code-needs-a-gradient.** Depth = border, not shadow.
- **Never use a serif.** Inter everywhere, IBM Plex Mono for numerics.
- **Never put more than one CTA per section.** Primary indigo button is rare and meaningful.
- **Progressive disclosure over density.** First load should feel uncluttered. Reasoning is one click away, not in your face.
- **Amber is for overdue, difficulty:medium, and streaks** — a single token `--warning: #f59e0b`. Locked via /plan-design-review 2026-04-15 after the two-amber token drift was caught.
- **Desktop only, 1440px target.** Mobile and tablet are out of scope.

## Problem workspace

Added via /plan-design-review 2026-04-15. Reference mockups live at `~/.gstack/projects/joncooper-sql-coach/designs/workspace-20260415/round-3/variant-D.png` (primary) and `round-2/variant-C.png` (secondary). See `approved.json` in the same directory for exact gap notes per variant.

The workspace is a three-panel IDE at 1440×900 target. It shares the top nav with home but replaces the mode toggle with a quiet breadcrumb.

### Layout

- Horizontal split: **LEFT 34% | RIGHT 66%**, with a 2px draggable handle that tints indigo on hover.
- RIGHT is a vertical split: **TOP 56% (editor) | BOTTOM 44% (results)**, same handle.

### Left panel — three zones

**Zone 1 — Problem context** (top, always visible, ~200px):
- Small-caps eyebrow: `[DIFFICULTY] · [CATEGORY] · PROBLEM [N]`
- Title: Inter semibold 24px
- Description: 14px Inter body, 2–4 lines max above the fold
- Due-for-review banner: 1px amber border + `--warning-soft` bg, italic text *"Due for review — solve again to strengthen mastery"*. Only rendered when `isReviewDue(stats)`.

**Zone 2 — Reference accordion** (middle, scrollable):
- Three sections: `SCHEMA`, `SAMPLE DATA`, `EXPECTED OUTPUT`
- Each section is a row with small-caps eyebrow label + chevron icon (down when expanded, right when collapsed)
- Multiple sections can be open at once (not mutually exclusive)
- Default state: `SCHEMA` expanded on first visit to a problem, all three collapsed on subsequent visits (stored per-slug in localStorage)
- SCHEMA content: one card per table, table name in IBM Plex Mono bold, column rows showing name + type badge
- SAMPLE DATA content: monospace table preview, 4–6 rows, tight density
- EXPECTED OUTPUT content: monospace table preview, same chrome as SAMPLE DATA

**Zone 3 — Assistance** (bottom, sticky, ~100px, 1px top border):
- Small-caps eyebrow: `ASSISTANCE`
- Two ghost buttons side by side: `Reveal hint (N)` and `Solution`
- `Solution` is visually muted with a lock icon until 3+ failed attempts
- Clicking `Solution` opens a branded modal (`.app-panel-strong`): *"Reveal the solution? You'll lose the chance to solve this unaided."* with `Reveal solution` (destructive, red border) and `Keep trying` (ghost) buttons. Replaces `window.confirm()` which breaks the register.

### Editor panel (top-right)

- Tab strip: single tab `query.sql` in IBM Plex Mono 13px with close-on-hover X
- Body: IBM Plex Mono 14px on pure white, line gutter in `--bg` with muted line numbers and 1px right border, indigo cursor, active line tinted 4% indigo
- Selection: `--accent-soft` background
- Matching brackets: 12% indigo tint + 25% indigo outline
- Syntax highlighting per `SqlEditor.tsx`: keywords `#4f46e5` semibold, strings `#10b981`, numbers `#f59e0b`, comments italic `#94a3b8`, types `#7c3aed`, functions `#4338ca`
- Bottom toolbar (48px, border-top only, **no shadow**):
  - LEFT: `Run query` ghost button with `⌘↵` hint, then PRIMARY `Check answer` indigo button with `⌘⇧↵` hint
  - RIGHT: Plex Mono timer pill, `Ask AI` ghost, `Reset` text link
  - Primary/secondary order matters. `Check answer` is primary — it gates progress.

### Results panel (bottom-right)

- Tab strip: `Run output` / `Coach chat` with indigo underline on active tab
- Right side of tab strip: `N rows · Xms` in Plex Mono `--text-muted`
- Results table:
  - Column headers in small-caps `--text-muted` on `--panel-muted`
  - 28px row height, 1px bottom border per row, **no zebra stripes**
  - IBM Plex Mono for all cells
  - Numeric columns right-aligned, string columns left-aligned
  - NULLs rendered as italic `null` in `--text-faint`
- Empty state: *"Run a query to see results here"* in `--text-muted`, centered
- Loading state: 3 skeleton rows matching row chrome
- Error state: monospace error text in `--danger`, `--danger-soft` panel background
- Diff mode (on submit): two tables stacked or side-by-side, missing rows highlighted with `--danger-soft` left-border, extra rows with `--warning-soft` left-border. Row-level diff, not cell-level.

### Accepted celebration

- **First-pass** submission: full modal overlay (`.app-panel-strong`, border-only — **no shadow**), centered, ~24px padding. `Accepted` eyebrow + *"Clean pass."* semibold in `--positive`, runtime + attempt count + mastery transition + total solved count. Three buttons: `Next problem` (primary if `adjacent.next` exists), `Return to Coach` (ghost), `Keep editing` (ghost).
- **Subsequent passes**: inline 3-second banner above results table, *"✓ Accepted · 34ms · N attempts"*, fades out. No modal. Celebrate every win but respect the attention budget.

### State matrix (required per surface)

Every workspace surface must handle these states explicitly. No silent blanks.

| Surface              | Load | Empty | Error | Success | Partial |
|----------------------|------|-------|-------|---------|---------|
| Home (initial fetch) |  ✓   |   ✓   |   ✓   |    —    |    —    |
| Coach pick           |  ✓   |   ✓   |   ✓   |    ✓    |    —    |
| Catalog table        |  ✓   |   ✓   |   ✓   |    —    |    —    |
| Workspace page       |  ✓   |   —   |   ✓   |    ✓    |    —    |
| Editor               |  ✓   |   ✓   |   —   |    —    |    —    |
| Run results          |  ✓   |   ✓   |   ✓   |    ✓    |    ✓    |
| Submit results       |  ✓   |   —   |   ✓   |    ✓    |  ✓ diff |
| Coach chat           |  ✓   |   ✓   |   ✓   |    —    |    ✓    |
| Pending analysis     |  ✓   |   —   |   ✓   |    ✓    |    —    |

### Accessibility requirements

- All modals: `aria-modal`, `aria-labelledby` on eyebrow, focus trap, Escape closes, focus returns to trigger.
- Editor: skip-to-editor link in nav, kbd shortcuts documented in a discoverable `? = shortcuts` overlay.
- Panel splitters: keyboard-adjustable via arrow keys when focused.
- Diff colors: supplement with icon (× for missing, + for extra) so colorblind users have a non-color cue.
- Activity chart (home): active days must differ from inactive by more than color alone (e.g., 1px top accent on active bars).
- Animations: wrap in `@media (prefers-reduced-motion: reduce)` — already enforced globally in `globals.css`.
- `--text-faint` (#94a3b8) fails WCAG AA on white at 2.85:1. Use only for decorative strokes, never for readable text content. Use `--text-muted` (#64748b, 5.74:1) for muted body text.
