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
- **Amber is for overdue only.** Don't use it for general highlights.
- **Desktop only, 1440px target.** Mobile and tablet are out of scope.
