import { NextRequest } from "next/server";
import { chatStream } from "@/lib/ollama";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts/coaching";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    messages = [],
    context,
  }: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    context: {
      description: string;
      tables: string[];
      studentSql: string;
      errorContext: string;
      attemptNumber: number;
    };
  } = body;

  // Build the initial context message
  const initialUserMsg = buildUserPrompt(context);

  // Assemble the full conversation for Ollama
  const ollamaMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: initialUserMsg },
    // Cap conversation history to last 10 messages
    ...messages.slice(-10),
  ];

  try {
    const stream = await chatStream(ollamaMessages);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    return new Response((err as Error).message, { status: 502 });
  }
}
