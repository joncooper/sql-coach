"use client";

import { useEffect, useState } from "react";

let cachedResult: { available: boolean } | null = null;
let fetchPromise: Promise<{ available: boolean }> | null = null;

async function fetchStatus(): Promise<{ available: boolean }> {
  try {
    const res = await fetch("/api/llm/status");
    if (!res.ok) return { available: false };
    return await res.json();
  } catch {
    return { available: false };
  }
}

export function useLlmStatus(): { available: boolean; loading: boolean } {
  const [status, setStatus] = useState<{ available: boolean } | null>(
    cachedResult
  );

  useEffect(() => {
    if (cachedResult) {
      setStatus(cachedResult);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchStatus().then((result) => {
        cachedResult = result;
        return result;
      });
    }

    fetchPromise.then(setStatus);
  }, []);

  return {
    available: status?.available ?? false,
    loading: status === null,
  };
}
