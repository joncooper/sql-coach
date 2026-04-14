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
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--text-muted)] [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--text-muted)] [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[color:var(--text-muted)] [animation-delay:300ms]" />
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
  const initializedRef = useRef(false);
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

  // Auto-send a fresh hint every time the coach is opened. Each open
  // is a new "I want a tip right now" signal, so the conversation
  // resets and a new initial request fires with the current editor
  // contents and whatever error context exists.
  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      initializedRef.current = true;
      setMessages([]);
      sendCoachingRequest([]);
    }
    if (!isOpen) {
      // Reset so the next open starts fresh.
      initializedRef.current = false;
      prevSqlRef.current = problemContext.studentSql;
    }
  }, [isOpen, sendCoachingRequest, problemContext.studentSql]);

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
    <div className="flex max-h-72 flex-col border-t border-[color:var(--border)] bg-[color:var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-2.5">
        <span className="eyebrow">AI Coach</span>
        <button
          onClick={onToggle}
          className="btn-ghost text-[color:var(--text-muted)]"
        >
          Close
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user"
                ? "ml-8 rounded-lg border border-[color:var(--border)] bg-[color:var(--accent-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--text)]"
                : "mr-8 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--panel-muted)] px-4 py-3 text-sm leading-6 text-[color:var(--text-soft)]"
            }
          >
            {msg.content}
          </div>
        ))}

        {/* Streaming content or typing indicator */}
        {isStreaming &&
          (streamedContent ? (
            <div className="mr-8 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--panel-muted)] px-4 py-3 text-sm leading-6 text-[color:var(--text-soft)]">
              {streamedContent}
              <span className="ml-0.5 inline-block animate-pulse text-[color:var(--accent)]">
                |
              </span>
            </div>
          ) : (
            <TypingIndicator />
          ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-[color:var(--border-subtle)] px-4 py-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up..."
          disabled={isStreaming}
          className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent)] focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
