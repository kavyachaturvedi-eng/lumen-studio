import { NextResponse } from "next/server";
import { judgeCandidate, parseDataUrl, DEMO_MODE } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { source?: string; candidate?: string; shotLabel?: string } | null;
  if (!body?.source || !body?.candidate) return NextResponse.json({ error: "Need source and candidate." }, { status: 400 });
  try {
    const score = await judgeCandidate(parseDataUrl(body.source), parseDataUrl(body.candidate), body.shotLabel || "product shot");
    return NextResponse.json({ score, demo: DEMO_MODE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[judge]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
