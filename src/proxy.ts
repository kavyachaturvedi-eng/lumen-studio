import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthed } from "@/lib/auth";

// Next.js 16 "proxy" (formerly middleware). Gates every page and API route behind the shared passcode.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname === "/unlock" || pathname === "/api/unlock" || pathname.startsWith("/_next") || pathname === "/favicon.ico";
  if (open) return NextResponse.next();

  if (await isAuthed(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorised — unlock the studio first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
