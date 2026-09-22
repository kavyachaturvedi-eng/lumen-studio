import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, CLIENT_COOKIE, isAdminCookie, readClientId } from "@/lib/auth";

// Next.js 16 "proxy" (formerly middleware).
// Two gates: clients reach the studio with their own passcode; only you reach /admin.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const alwaysOpen =
    pathname === "/unlock" ||
    pathname === "/api/unlock" ||
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";
  if (alwaysOpen) return NextResponse.next();

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin");

  if (isAdminArea) {
    if (await isAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (await readClientId(req.cookies.get(CLIENT_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorised — unlock the studio first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
