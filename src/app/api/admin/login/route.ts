import { NextResponse } from "next/server";
import { ADMIN_COOKIE, COOKIE_OPTS, adminEnabled, adminPasscodeMatches, makeToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  if (!adminEnabled()) {
    return NextResponse.json({ ok: false, error: "ADMIN_PASSCODE is not set on this deployment." }, { status: 500 });
  }
  if (!passcode || !(await adminPasscodeMatches(passcode))) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, error: "Wrong admin passcode." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await makeToken("admin"), COOKIE_OPTS);
  return res;
}
