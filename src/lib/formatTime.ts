/**
 * Pure time-formatting helpers shared across the workspace surfaces.
 * Kept in /lib so the existing `bun test` infrastructure can cover
 * them without needing a React component testing framework.
 */

/**
 * Format milliseconds as a zero-padded `mm:ss` timer label.
 *   formatElapsed(0)      → "00:00"
 *   formatElapsed(9_000)  → "00:09"
 *   formatElapsed(65_000) → "01:05"
 *   formatElapsed(3_600_000) → "60:00"   (caps in minutes, does not roll to hours)
 */
export function formatElapsed(ms: number): string {
  const safe = Math.max(0, ms);
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Render a past timestamp as a short relative label. Used on revealed hints
 * so re-reading feels cheap.
 *   (now - t) < 1 min     → "just now"
 *   (now - t) < 60 min    → "Xm ago"
 *   (now - t) < 24 hours  → "Xh ago"
 *   otherwise             → "Xd ago"
 *
 * `now` is injectable for testing; defaults to Date.now().
 */
export function formatRevealedAt(ms: number, now: number = Date.now()): string {
  const delta = Math.max(0, now - ms);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
