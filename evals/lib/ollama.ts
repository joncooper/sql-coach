const BASE_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatParams {
  model: string;
  messages: ChatMessage[];
  format?: "json";
  num_predict?: number;
}

interface ChatResponse {
  message: { role: string; content: string; thinking?: string };
  total_duration: number;
  eval_count: number;
  prompt_eval_count: number;
}

export interface OllamaResult {
  content: string;
  thinking?: string;
  latency_ms: number;
  tokens_per_sec: number;
  eval_count: number;
  prompt_eval_count: number;
}

export async function chat(params: ChatParams): Promise<OllamaResult> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
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

  const data: ChatResponse = await res.json();
  const latency_ms = Math.round((data.total_duration ?? 0) / 1e6);
  const tokens_per_sec =
    data.total_duration > 0
      ? Math.round((data.eval_count / (data.total_duration / 1e9)) * 10) / 10
      : 0;

  return {
    content: data.message.content,
    thinking: data.message.thinking ?? undefined,
    latency_ms,
    tokens_per_sec,
    eval_count: data.eval_count,
    prompt_eval_count: data.prompt_eval_count,
  };
}

interface OllamaModel {
  name: string;
  size: number;
  details: { parameter_size: string; family: string; quantization_level: string };
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${BASE_URL}/api/tags`);
  if (!res.ok) throw new Error(`Ollama not reachable at ${BASE_URL}`);
  const data = await res.json();
  return data.models;
}

export async function ensureModel(name: string): Promise<void> {
  const models = await listModels();
  const found = models.some(
    (m) => m.name === name || m.name === `${name}:latest`
  );
  if (!found) {
    const available = models.map((m) => m.name).join(", ");
    throw new Error(
      `Model "${name}" not found. Available: ${available}`
    );
  }
}
