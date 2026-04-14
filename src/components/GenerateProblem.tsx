"use client";

import { useState, useRef, useCallback } from "react";
import DifficultyBadge from "@/components/DifficultyBadge";

interface GenerateProblemProps {
  onGenerated: (slug: string) => void;
}

type Stage = "idle" | "thinking" | "preview" | "validating" | "done" | "error";

interface ProblemPreview {
  title: string;
  difficulty: "easy" | "medium" | "hard";
  description: string;
  category: string;
}

export default function GenerateProblem({
  onGenerated,
}: GenerateProblemProps) {
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium"
  );
  const [topic, setTopic] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [thinking, setThinking] = useState("");
  const [preview, setPreview] = useState<ProblemPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatedSlug, setGeneratedSlug] = useState<string | null>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    setStage("thinking");
    setThinking("");
    setPreview(null);
    setError(null);
    setGeneratedSlug(null);

    try {
      const res = await fetch("/api/llm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, topic: topic.trim() || undefined }),
      });

      if (!res.ok) {
        setStage("error");
        setError(`Server error: ${res.status}`);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.type === "thinking") {
              setThinking((prev) => prev + msg.content);
              if (thinkingRef.current) {
                thinkingRef.current.scrollTop =
                  thinkingRef.current.scrollHeight;
              }
            } else if (msg.type === "retrying") {
              setStage("thinking");
              setPreview(null);
              setError(null);
            } else if (msg.type === "preview") {
              setStage("preview");
              setPreview(msg.problem);
            } else if (msg.type === "validating") {
              setStage("validating");
            } else if (msg.type === "done") {
              setStage("done");
              setGeneratedSlug(msg.slug);
            } else if (msg.type === "error") {
              setStage("error");
              setError(msg.message);
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch {
      setStage("error");
      setError("Connection error. Is the dev server running?");
    }
  }, [difficulty, topic]);

  const stageLabel: Record<Stage, string> = {
    idle: "",
    thinking: "Designing schema...",
    preview: "Schema designed",
    validating: "Validating in PostgreSQL...",
    done: "Done!",
    error: "Generation failed",
  };

  const isGenerating = stage !== "idle" && stage !== "done" && stage !== "error";

  return (
    <div>
      <div className="eyebrow">Generate problem</div>
      <p className="mt-2 mb-4 text-sm leading-6 text-[color:var(--text-muted)]">
        Spin up a fresh prompt when you want a new angle without leaving the
        workspace.
      </p>

      {/* Difficulty selector */}
      <div className="mb-3 flex gap-1.5">
        {(["easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            disabled={isGenerating}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              difficulty === d
                ? d === "easy"
                  ? "bg-[color:var(--positive-soft)] text-[color:var(--positive)]"
                  : d === "medium"
                    ? "bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
                    : "bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                : "bg-[color:var(--panel-muted)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            } disabled:opacity-50`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Topic input */}
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic (optional)"
        disabled={isGenerating}
        className="mb-3 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent)] focus:outline-none disabled:opacity-50"
      />

      {/* Generate button */}
      {stage === "idle" && (
        <button
          onClick={handleGenerate}
          className="btn-primary w-full"
        >
          Generate
        </button>
      )}

      {/* Progress area */}
      {stage !== "idle" && (
        <div className="mt-2 space-y-2">
          {/* Stage label */}
          <div className="flex items-center gap-2">
            {isGenerating && (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent)]" />
            )}
            {stage === "done" && (
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--positive)]" />
            )}
            {stage === "error" && (
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--danger)]" />
            )}
            <span
              className={`text-xs font-medium ${
                stage === "done"
                  ? "text-[color:var(--positive)]"
                  : stage === "error"
                    ? "text-[color:var(--danger)]"
                    : "text-[color:var(--text-soft)]"
              }`}
            >
              {stageLabel[stage]}
            </span>
          </div>

          {/* Thinking stream */}
          {thinking && (
            <div
              ref={thinkingRef}
              className="max-h-32 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-muted)] p-3 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[color:var(--text-muted)]"
              style={{ scrollbarWidth: "thin" }}
            >
              {thinking}
            </div>
          )}

          {/* Skeleton preview */}
          {preview && (
            <div className="relative rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              {stage === "validating" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[color:var(--surface)]/80">
                  <span className="animate-pulse text-xs font-medium text-[color:var(--text-soft)]">
                    Validating...
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-[color:var(--text)]">
                  {preview.title}
                </span>
                <DifficultyBadge difficulty={preview.difficulty} />
              </div>
              <div className="eyebrow mt-2">{preview.category}</div>
              <div className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--text-soft)]">
                {preview.description.replace(/\*\*/g, "")}
              </div>
            </div>
          )}

          {/* Error */}
          {stage === "error" && error && (
            <div className="rounded-lg border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] px-4 py-3 text-xs text-[color:var(--danger)]">
              {error}
            </div>
          )}

          {/* Actions */}
          {stage === "done" && generatedSlug && (
            <button
              onClick={() => onGenerated(generatedSlug)}
              className="btn-primary w-full"
              style={{
                background: "var(--positive)",
                borderColor: "var(--positive)",
              }}
            >
              Go to problem
            </button>
          )}

          {(stage === "done" || stage === "error") && (
            <button
              onClick={() => {
                setStage("idle");
                setThinking("");
                setPreview(null);
                setError(null);
                setGeneratedSlug(null);
              }}
              className="btn-secondary w-full"
            >
              {stage === "error" ? "Try again" : "Generate another"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
