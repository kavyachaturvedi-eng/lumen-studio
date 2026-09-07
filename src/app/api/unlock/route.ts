import { NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken, gateEnabled, passcodeMatches } from "@/lib/auth";

export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  if (!gateEnabled()) return NextResponse.json({ ok: true, note: "No APP_PASSCODE set — studio is open." });
  if (!passcode || !(await passcodeMatches(passcode))) {
    await new Promise((r) => setTimeout(r, 600)); // slow brute force a little
    return NextResponse.json({ ok: false, error: "Wrong passcode." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
