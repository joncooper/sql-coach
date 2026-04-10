"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CoachingMessage {
  role: "user" | "assistant";
  content: string;
}

interface CoachingChatProps {
  problemContext: {
    description: string;
    tables: string[];
    studentSql: string;
    errorContext: string;
    attemptNumber: number;
  };
  isOpen: boolean;
  onToggle: () => void;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
    </div>
  );
}

export default function CoachingChat({
  problemContext,
  isOpen,
  onToggle,
}: CoachingChatProps) {
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [streamedContent, setStreamedContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [hasInitialized, setHasInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevSqlRef = useRef(problemContext.studentSql);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(scrollToBottom, [messages, streamedContent, scrollToBottom]);

  const sendCoachingRequest = useCallback(
    async (conversationMessages: CoachingMessage[]) => {
      setIsStreaming(true);
      setStreamedContent("");

      try {
        const res = await fetch("/api/llm/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: conversationMessages,
            context: problemContext,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Could not reach AI coach: ${errorText}`,
            },
          ]);
          setIsStreaming(false);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamedContent(accumulated);
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: accumulated },
        ]);
        setStreamedContent("");
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Connection error. Please try again.",
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [problemContext]
  );

  // Auto-send first coaching request when opened
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setHasInitialized(true);
      sendCoachingRequest([]);
    }
  }, [isOpen, hasInitialized, sendCoachingRequest]);

  // Detect re-submission (student SQL changed)
  useEffect(() => {
    if (
      hasInitialized &&
      problemContext.studentSql !== prevSqlRef.current &&
      problemContext.studentSql.trim()
    ) {
      prevSqlRef.current = problemContext.studentSql;
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: "(Re-submitted with updated SQL)",
        },
      ]);
      sendCoachingRequest([
        ...messages,
        { role: "user", content: "(Re-submitted with updated SQL)" },
      ]);
    }
  }, [problemContext.studentSql]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const newMessages: CoachingMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    sendCoachingRequest(newMessages);
  }, [input, isStreaming, messages, sendCoachingRequest]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  if (!isOpen) return null;

  return (
    <div className="flex max-h-64 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          AI Coach
        </span>
        <button
          onClick={onToggle}
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >
          Close
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user"
                ? "ml-8 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300"
                : "mr-8 text-sm leading-relaxed text-zinc-300"
            }
          >
            {msg.content}
          </div>
        ))}

        {/* Streaming content or typing indicator */}
        {isStreaming &&
          (streamedContent ? (
            <div className="mr-8 text-sm leading-relaxed text-zinc-300">
              {streamedContent}
              <span className="ml-0.5 inline-block animate-pulse text-blue-400">
                |
              </span>
            </div>
          ) : (
            <TypingIndicator />
          ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up..."
          disabled={isStreaming}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
