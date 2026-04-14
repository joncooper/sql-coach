export default function DifficultyBadge({
  difficulty,
}: {
  difficulty: "easy" | "medium" | "hard";
}) {
  return <span className={`pill pill-${difficulty}`}>{difficulty}</span>;
}
