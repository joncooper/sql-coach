import { NextResponse } from "next/server";
import { checkStatus } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkStatus();
  return NextResponse.json(status);
}
