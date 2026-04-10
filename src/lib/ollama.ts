const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "gemma4";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Non-streaming chat (for problem generation with format: "json") */
export async function chat(params: {
  messages: ChatMessage[];
  format?: "json";
  num_predict?: number;
}): Promise<{ content: string }> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: params.messages,
      stream: false,
      ...(params.format && { format: params.format }),
      ...(params.num_predict && { options: { num_predict: params.num_predict } }),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body}`);
  }

  const data = await res.json();
  return { content: data.message.content };
}

/**
 * Streaming chat — returns a ReadableStream of plain text content tokens.
 * Used for coaching where we only need the response text.
 */
export async function chatStream(
  messages: ChatMessage[]
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, stream: true }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body}`);
  }

  const encoder = new TextEncoder();

  return res.body!.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      buffer: "",
      transform(chunk, controller) {
        // Ollama sends newline-delimited JSON
        const text =
          (this as unknown as { buffer: string }).buffer +
          new TextDecoder().decode(chunk, { stream: true });
        const lines = text.split("\n");
        // Last element may be incomplete — buffer it
        (this as unknown as { buffer: string }).buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              controller.enqueue(encoder.encode(data.message.content));
            }
          } catch {
            // skip malformed lines
          }
        }
      },
      flush(controller) {
        const remaining = (this as unknown as { buffer: string }).buffer;
        if (remaining.trim()) {
          try {
            const data = JSON.parse(remaining);
            if (data.message?.content) {
              controller.enqueue(encoder.encode(data.message.content));
            }
          } catch {
            // skip
          }
        }
      },
    } as Transformer<Uint8Array, Uint8Array> & { buffer: string })
  );
}

/**
 * Raw streaming chat — returns the Ollama NDJSON stream directly.
 * Used for problem generation where we need both thinking and content tokens.
 * Each line is a JSON object with message.thinking and/or message.content.
 */
export async function chatStreamRaw(
  messages: ChatMessage[],
  format?: "json",
  num_predict?: number
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      ...(format && { format }),
      ...(num_predict && { options: { num_predict } }),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${res.status}: ${body}`);
  }

  return res.body!;
}

/** Check if Ollama is running and the model is available */
export async function checkStatus(): Promise<{
  available: boolean;
  model: string | null;
}> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { available: false, model: null };

    const data = await res.json();
    const models: Array<{ name: string }> = data.models ?? [];
    const found = models.some(
      (m) => m.name === MODEL || m.name === `${MODEL}:latest`
    );
    return { available: found, model: found ? MODEL : null };
  } catch {
    return { available: false, model: null };
  }
}
