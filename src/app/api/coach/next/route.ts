import { NextResponse } from "next/server";
import { listProblems } from "@/lib/problems";
import { pickNextProblem } from "@/lib/coach";
import type { StatsStore } from "@/types";

/**
 * POST /api/coach/next
 *
 * Body: { store: StatsStore }
 *
 * Returns a CoachPick: the next recommended problem plus full reasoning
 * (mastery per category, candidate pool, learning path). The client
 * calls `pickNextProblem` directly in most cases (stats live in
 * localStorage), but this endpoint exists for:
 *
 *   - server-side rendering once stats move off localStorage
 *   - external agents or integrations that want a recommendation
 *   - debugging: curl POST a store JSON and inspect the pick
 *
 * The endpoint is pure — no DB writes, no telemetry, no side effects.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Body must be an object with a `store` field" },
      { status: 400 }
    );
  }

  const store = (body as { store?: StatsStore }).store;
  if (
    !store ||
    typeof store !== "object" ||
    !("problems" in store) ||
    !("global" in store)
  ) {
    return NextResponse.json(
      { error: "Missing or malformed `store` in request body" },
      { status: 400 }
    );
  }

  const problems = await listProblems();
  const pick = pickNextProblem(store, problems);
  return NextResponse.json(pick);
}
