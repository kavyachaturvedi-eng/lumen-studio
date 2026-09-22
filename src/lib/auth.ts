// Session cookies for clients and for you (the owner).
//
// A cookie is "<subject>.<hmac>" — the client id, or "admin". The proxy can
// verify it with the secret alone, so gating a request costs no database call;
// API routes then load the client record from the store when they need it.

export const CLIENT_COOKIE = "lumen_client";
export const ADMIN_COOKIE = "lumen_admin";

function secret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSCODE || "lumen-dev-secret";
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("lumen:" + secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeToken(subject: string): Promise<string> {
  return `${subject}.${await sign(subject)}`;
}

/** Returns the subject (client id, or "admin") if the cookie is valid. */
export async function readToken(cookie: string | undefined): Promise<string | null> {
  if (!cookie) return null;
  const idx = cookie.lastIndexOf(".");
  if (idx <= 0) return null;
  const subject = cookie.slice(0, idx);
  const sig = cookie.slice(idx + 1);
  const expected = await sign(subject);
  return timingSafeEqual(sig, expected) ? subject : null;
}

export async function readClientId(cookie: string | undefined): Promise<string | null> {
  const subject = await readToken(cookie);
  return subject && subject !== "admin" ? subject : null;
}

export async function isAdminCookie(cookie: string | undefined): Promise<boolean> {
  return (await readToken(cookie)) === "admin";
}

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSCODE);
}

export async function adminPasscodeMatches(input: string): Promise<boolean> {
  const configured = process.env.ADMIN_PASSCODE || "";
  if (!configured) return false;
  return timingSafeEqual(await sign(input), await sign(configured));
}

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
