import { NextResponse } from "next/server";
import { CLIENT_COOKIE, COOKIE_OPTS, makeToken } from "@/lib/auth";
import { clientIdForPasscode, ensureSeedClient, getClient } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  if (!passcode?.trim()) return NextResponse.json({ ok: false, error: "Enter your passcode." }, { status: 400 });

  await ensureSeedClient();

  const id = await clientIdForPasscode(passcode);
  const client = id ? await getClient(id) : null;

  if (!client) {
    await new Promise((r) => setTimeout(r, 600)); // slow brute force a little
    return NextResponse.json({ ok: false, error: "That passcode isn't recognised." }, { status: 401 });
  }
  if (!client.active) {
    return NextResponse.json({ ok: false, error: "This account is paused. Contact the studio owner." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, client: { name: client.name, plan: client.plan } });
  res.cookies.set(CLIENT_COOKIE, await makeToken(client.id), COOKIE_OPTS);
  return res;
}
