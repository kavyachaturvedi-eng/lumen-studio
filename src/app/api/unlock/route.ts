import { NextResponse } from "next/server";
import { CLIENT_COOKIE, COOKIE_OPTS, makeToken } from "@/lib/auth";
import { ensureSeedClient, verifyLogin } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username, passcode } = (await req.json().catch(() => ({}))) as { username?: string; passcode?: string };
  if (!username?.trim() || !passcode?.trim()) {
    return NextResponse.json({ ok: false, error: "Enter your username and passcode." }, { status: 400 });
  }

  await ensureSeedClient();

  const result = await verifyLogin(username, passcode);
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 500)); // slow scripted guessing a little more
    if (result.reason === "locked") {
      return NextResponse.json(
        { ok: false, error: "Too many wrong attempts. Try again in 15 minutes, or ask the studio to reset your login." },
        { status: 429 },
      );
    }
    return NextResponse.json({ ok: false, error: "That username and passcode don't match." }, { status: 401 });
  }

  const client = result.client;
  if (!client.active) {
    return NextResponse.json({ ok: false, error: "This account is paused. Contact the studio owner." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, client: { name: client.name, plan: client.plan } });
  res.cookies.set(CLIENT_COOKIE, await makeToken(client.id), COOKIE_OPTS);
  return res;
}
