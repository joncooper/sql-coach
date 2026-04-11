import { NextRequest } from "next/server";
import { chatStreamRaw } from "@/lib/ollama";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts/problem-gen";
import { validateAndCreate, storeGenerated } from "@/lib/generated";
import { invalidateCache } from "@/lib/problems";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const maxDuration = 120;

const TRACES_DIR = join(process.cwd(), "evals", "traces");
const MAX_ATTEMPTS = 3;

interface TraceEntry {
  timestamp: string;
  attempt: number;
  prompt: string;
  raw_response?: string;
  parsed?: unknown;
  validation_error?: string;
  success: boolean;
  duration_ms: number;
}

async function writeTrace(
  topic: string | undefined,
  difficulty: string | undefined,
  entries: TraceEntry[]
) {
  try {
    await mkdir(TRACES_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = (topic ?? "random").replace(/[^a-z0-9]/gi, "-").slice(0, 30);
    const filename = `gen-${ts}-${slug}.json`;
    await writeFile(
      join(TRACES_DIR, filename),
      JSON.stringify({ topic, difficulty, attempts: entries }, null, 2)
    );
  } catch {
    // Trace logging should never break generation
  }
}

async function callOllama(
  userPrompt: string,
  send: (obj: Record<string, unknown>) => void
): Promise<string> {
  const ollamaStream = await chatStreamRaw(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    "json",
    4096
  );

  const reader = ollamaStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.message?.thinking) {
          send({ type: "thinking", content: data.message.thinking });
        }
        if (data.message?.content) {
          accumulatedContent += data.message.content;
        }
      } catch {
        // skip malformed
      }
    }
  }

  if (buffer.trim()) {
    try {
      const data = JSON.parse(buffer);
      if (data.message?.thinking) {
        send({ type: "thinking", content: data.message.thinking });
      }
      if (data.message?.content) {
        accumulatedContent += data.message.content;
      }
    } catch {
      // skip
    }
  }

  return accumulatedContent;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    difficulty,
    topic,
  }: { difficulty?: "easy" | "medium" | "hard"; topic?: string } = body;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      const traceEntries: TraceEntry[] = [];

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const start = Date.now();
        const userPrompt = buildUserPrompt({ difficulty, topic });

        if (attempt > 1) {
          send({ type: "retrying", attempt, max: MAX_ATTEMPTS });
          // Clear previous thinking/preview for clean retry
          send({ type: "thinking", content: `\n--- Retry ${attempt}/${MAX_ATTEMPTS} ---\n` });
        }

        try {
          // Stream LLM response
          const accumulatedContent = await callOllama(userPrompt, send);

          // Parse JSON
          let parsed;
          try {
            parsed = JSON.parse(accumulatedContent);
          } catch {
            const entry: TraceEntry = {
              timestamp: new Date().toISOString(),
              attempt,
              prompt: userPrompt,
              raw_response: accumulatedContent.slice(0, 2000),
              success: false,
              validation_error: "Invalid JSON from model",
              duration_ms: Date.now() - start,
            };
            traceEntries.push(entry);

            if (attempt === MAX_ATTEMPTS) {
              send({ type: "error", message: "Model produced invalid JSON after all retries" });
              await writeTrace(topic, difficulty, traceEntries);
              controller.close();
              return;
            }
            continue;
          }

          // Show preview
          if (parsed.problem) {
            send({
              type: "preview",
              problem: {
                title: parsed.problem.title,
                difficulty: parsed.problem.difficulty,
                description: parsed.problem.description,
                category: parsed.problem.category,
              },
            });
          }

          // Validate in PostgreSQL
          send({ type: "validating" });

          const gp = await validateAndCreate(parsed);
          await storeGenerated(gp);
          invalidateCache();

          // Success — log and return
          traceEntries.push({
            timestamp: new Date().toISOString(),
            attempt,
            prompt: userPrompt,
            parsed: {
              schema_name: parsed.schema_name,
              tables: parsed.problem?.tables,
              slug: parsed.problem?.slug,
            },
            success: true,
            duration_ms: Date.now() - start,
          });
          await writeTrace(topic, difficulty, traceEntries);

          send({
            type: "done",
            slug: gp.problem.slug,
            title: gp.problem.title,
          });
          controller.close();
          return;
        } catch (err: unknown) {
          const errorMsg = (err as Error).message;
          traceEntries.push({
            timestamp: new Date().toISOString(),
            attempt,
            prompt: userPrompt,
            validation_error: errorMsg,
            success: false,
            duration_ms: Date.now() - start,
          });

          if (attempt === MAX_ATTEMPTS) {
            send({ type: "error", message: `${errorMsg} (failed after ${MAX_ATTEMPTS} attempts)` });
            await writeTrace(topic, difficulty, traceEntries);
            controller.close();
            return;
          }
          // Will retry
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
