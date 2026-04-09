import type { MasteryLevel } from "@/types";

const config: Record<MasteryLevel, { label: string; content: string; className: string }> = {
  unattempted: {
    label: "Not attempted",
    content: "\u2022",
    className: "text-zinc-700",
  },
  attempted: {
    label: "Attempted",
    content: "\u2022",
    className: "text-orange-400",
  },
  solved: {
    label: "Solved",
    content: "\u2713",
    className: "text-emerald-500",
  },
  practiced: {
    label: "Practiced",
    content: "\u2713\u2713",
    className: "text-blue-400 tracking-[-0.15em]",
  },
  mastered: {
    label: "Mastered",
    content: "\u2605",
    className: "text-amber-400",
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
