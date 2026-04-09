import { NextResponse } from "next/server";
import { listProblems } from "@/lib/problems";

export async function GET() {
  const problems = await listProblems();
  return NextResponse.json(problems);
}
