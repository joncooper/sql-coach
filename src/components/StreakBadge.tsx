"use client";

import { useEffect, useState } from "react";
import { loadStats, computeStreak } from "@/lib/stats";

function localDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export default function StreakBadge() {
  const [streak, setStreak] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const stats = loadStats();
    const currentStreak = computeStreak(stats.global.activeDays);
    setStreak(currentStreak);

    const today = localDateKey(new Date());
    const days = stats.global.activeDays;
    if (days.length > 0 && days[days.length - 1] === today) {
      setPulse(true);
    }
  }, []);

  if (streak === 0) return null;

  const glowClass = streak >= 7 ? "animate-streak-glow" : "";
  const pulseClass = pulse ? "animate-streak-pulse" : "";

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--highlight-soft)] px-3 py-1 text-xs font-medium text-[color:var(--highlight)] ${pulseClass}`}
      title={`${streak}-day streak`}
    >
      <span className={glowClass} aria-hidden>
        &#128293;
      </span>
      <span className="num font-semibold tabular-nums">{streak}</span>
      <span className="text-[color:var(--text-muted)]">
        {streak === 1 ? "day" : "days"}
      </span>
    </div>
  );
}
