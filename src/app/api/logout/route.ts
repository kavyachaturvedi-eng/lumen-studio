import { NextResponse } from "next/server";
import { CLIENT_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

/** Sign the client out and send them back to the sign-in screen. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/unlock", req.url), 303);
  res.cookies.set(CLIENT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
