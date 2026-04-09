"use client";

import { useEffect, useState } from "react";
import { loadStats, computeStreak } from "@/lib/stats";

export default function StreakBadge() {
  const [streak, setStreak] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const stats = loadStats();
    const currentStreak = computeStreak(stats.global.activeDays);
    setStreak(currentStreak);

    // Pulse if user was active today (streak was just maintained/started)
    const today = new Date().toISOString().slice(0, 10);
    const days = stats.global.activeDays;
    if (days.length > 0 && days[days.length - 1] === today) {
      setPulse(true);
    }
  }, []);

  if (streak === 0) return null;

  const glowClass = streak >= 7 ? "animate-streak-glow" : "";
  const pulseClass = pulse ? "animate-streak-pulse" : "";

  return (
    <div className={`flex items-center gap-1 text-sm text-amber-400 ${pulseClass}`}>
      <span className={glowClass}>&#128293;</span>
      <span className="font-medium">{streak}</span>
    </div>
  );
}
