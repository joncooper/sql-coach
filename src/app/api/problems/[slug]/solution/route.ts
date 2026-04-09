import { NextRequest, NextResponse } from "next/server";
import { getProblem } from "@/lib/problems";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();

  if (!body.confirm) {
    return NextResponse.json(
      { error: "Confirmation required" },
      { status: 400 }
    );
  }

  const problem = await getProblem(slug);
  if (!problem) {
    return NextResponse.json(
      { error: "Problem not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ solution: problem.solution });
}
