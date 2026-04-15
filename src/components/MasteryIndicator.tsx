import type { MasteryLevel } from "@/types";

const config: Record<
  MasteryLevel,
  { label: string; content: string; className: string }
> = {
  unattempted: {
    label: "Not attempted",
    content: "\u25CB",
    className: "text-[color:var(--text-muted)]",
  },
  attempted: {
    label: "Attempted",
    content: "\u25D4",
    className: "text-[color:var(--warning)]",
  },
  solved: {
    label: "Solved",
    content: "\u2713",
    className: "text-[color:var(--positive)]",
  },
  practiced: {
    label: "Practiced",
    content: "\u2713\u2713",
    className: "text-[color:var(--accent)] tracking-[-0.15em]",
  },
  mastered: {
    label: "Mastered",
    content: "\u2605",
    className: "text-[color:var(--accent-strong)]",
  },
};

export default function MasteryIndicator({ level }: { level: MasteryLevel }) {
  const { label, content, className } = config[level];
  return (
    <span className={`text-sm ${className}`} title={label} aria-label={label}>
      {content}
    </span>
  );
}
