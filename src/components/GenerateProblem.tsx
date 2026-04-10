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
              // Auto-scroll thinking area
              if (thinkingRef.current) {
                thinkingRef.current.scrollTop =
                  thinkingRef.current.scrollHeight;
              }
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
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Generate Problem
      </h2>

      {/* Difficulty selector */}
      <div className="mb-2 flex gap-1">
        {(["easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            disabled={isGenerating}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              difficulty === d
                ? d === "easy"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : d === "medium"
                    ? "bg-amber-400/20 text-amber-400"
                    : "bg-red-400/20 text-red-400"
                : "text-zinc-500 hover:text-zinc-300"
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
        className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
      />

      {/* Generate button */}
      {stage === "idle" && (
        <button
          onClick={handleGenerate}
          className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
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
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            )}
            {stage === "done" && (
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            )}
            {stage === "error" && (
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            )}
            <span
              className={`text-xs font-medium ${
                stage === "done"
                  ? "text-emerald-400"
                  : stage === "error"
                    ? "text-red-400"
                    : "text-zinc-400"
              }`}
            >
              {stageLabel[stage]}
            </span>
          </div>

          {/* Thinking stream */}
          {thinking && (
            <div
              ref={thinkingRef}
              className="max-h-32 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/50 p-2 font-mono text-[10px] leading-relaxed text-zinc-600"
              style={{ scrollbarWidth: "thin" }}
            >
              {thinking}
            </div>
          )}

          {/* Skeleton preview */}
          {preview && (
            <div className="relative rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
              {stage === "validating" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-md bg-zinc-950/60">
                  <span className="text-xs font-medium text-zinc-400 animate-pulse">
                    Validating...
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  {preview.title}
                </span>
                <DifficultyBadge difficulty={preview.difficulty} />
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {preview.category}
              </div>
              <div className="mt-1.5 line-clamp-2 text-xs text-zinc-400">
                {preview.description.replace(/\*\*/g, "")}
              </div>
            </div>
          )}

          {/* Error */}
          {stage === "error" && error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          {stage === "done" && generatedSlug && (
            <button
              onClick={() => onGenerated(generatedSlug)}
              className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
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
              className="w-full rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
            >
              {stage === "error" ? "Try again" : "Generate another"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
