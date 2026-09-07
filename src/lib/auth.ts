// Shared-passcode gate. One passcode for you and your client; no accounts.
// The cookie stores an HMAC of the passcode so the passcode itself never travels back.

export const AUTH_COOKIE = "lumen_session";

async function hmac(value: string): Promise<string> {
  const secret = process.env.APP_PASSCODE || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("lumen:" + secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function gateEnabled(): boolean {
  return Boolean(process.env.APP_PASSCODE);
}

export async function expectedToken(): Promise<string> {
  return hmac("session-v1");
}

export async function passcodeMatches(input: string): Promise<boolean> {
  const a = await hmac(input);
  const b = await hmac(process.env.APP_PASSCODE || "");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isAuthed(cookieValue: string | undefined): Promise<boolean> {
  if (!gateEnabled()) return true;
  if (!cookieValue) return false;
  return cookieValue === (await expectedToken());
}
