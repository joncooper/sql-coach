import { NextRequest } from "next/server";
import { chatStreamRaw } from "@/lib/ollama";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts/problem-gen";
import { validateAndCreate, storeGenerated } from "@/lib/generated";
import { invalidateCache } from "@/lib/problems";

export const maxDuration = 120; // allow up to 2 minutes

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    difficulty,
    topic,
  }: { difficulty?: "easy" | "medium" | "hard"; topic?: string } = body;

  const userPrompt = buildUserPrompt({ difficulty, topic });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      try {
        // Get raw Ollama stream
        const ollamaStream = await chatStreamRaw(
          [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          "json",
          4096
        );

        // Process the NDJSON stream from Ollama
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

              // Stream thinking tokens to the client
              if (data.message?.thinking) {
                send({ type: "thinking", content: data.message.thinking });
              }

              // Accumulate content tokens silently
              if (data.message?.content) {
                accumulatedContent += data.message.content;
              }
            } catch {
              // skip malformed
            }
          }
        }

        // Process any remaining buffer
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

        // Parse the accumulated JSON content
        let parsed;
        try {
          parsed = JSON.parse(accumulatedContent);
        } catch {
          send({ type: "error", message: "Model produced invalid JSON" });
          controller.close();
          return;
        }

        // Send preview
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

        send({
          type: "done",
          slug: gp.problem.slug,
          title: gp.problem.title,
        });
      } catch (err: unknown) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
