import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CLIENT_COOKIE, readClientId } from "@/lib/auth";
import { getClient } from "@/lib/store";
import { DEMO_MODE, describeProduct, parseDataUrl } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Style description costs no credits — it's a cheap text call and we want people to use it. */
export async function POST(req: Request) {
  const jar = await cookies();
  const id = await readClientId(jar.get(CLIENT_COOKIE)?.value);
  if (!id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const client = await getClient(id);
  if (!client?.active) return NextResponse.json({ error: "This account is paused." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { source?: string } | null;
  if (!body?.source) return NextResponse.json({ error: "Missing source image." }, { status: 400 });

  try {
    const description = await describeProduct(parseDataUrl(body.source));
    return NextResponse.json({ description, demo: DEMO_MODE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[describe]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
