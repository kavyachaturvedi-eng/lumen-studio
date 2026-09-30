// Client accounts, credit balances and usage log.
//
// Backed by Upstash Redis (or Vercel KV, which is Upstash underneath). If no
// Redis credentials are present the store falls back to an in-memory map so the
// app still runs locally and in demo mode — that fallback is per-process and is
// lost on restart, so never rely on it in production.

import { Redis } from "@upstash/redis";
import { PLANS, type PlanId } from "./plans";

export interface ClientRecord {
  id: string;
  name: string;
  /** Login name the client types on the unlock screen. Lowercase, unique. */
  username?: string;
  /** PBKDF2-SHA256 of the passcode, hex. Never leaves the server. */
  passHash?: string;
  passSalt?: string;
  plan: PlanId;
  creditsTotal: number;
  active: boolean;
  note?: string;
  createdAt: number;
  lastActiveAt?: number;
}

export interface ClientWithUsage extends Omit<ClientRecord, "passHash" | "passSalt"> {
  /** True once a username + passcode has been set. */
  hasLogin: boolean;
  creditsUsed: number;
  creditsLeft: number;
  /** 0–100, what the client sees. Never a currency figure. */
  percentLeft: number;
}

export interface UsageEntry {
  at: number;
  action: string; // "Packshot", "Edit", "Upscale 4K"…
  credits: number;
  model?: string;
}

const P = "lumen:";
const kClient = (id: string) => `${P}client:${id}`;
const kUsed = (id: string) => `${P}client:${id}:used`;
const kLog = (id: string) => `${P}client:${id}:log`;
const kUser = (username: string) => `${P}user:${username}`;
const kFail = (username: string) => `${P}fail:${username}`;
const K_CLIENTS = `${P}clients`;

/* ---------------- backend ---------------- */

let redis: Redis | null = null;
let redisChecked = false;

function getRedis(): Redis | null {
  if (redisChecked) return redis;
  redisChecked = true;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) redis = new Redis({ url, token });
  return redis;
}

export function storageReady(): boolean {
  return getRedis() !== null;
}

/** In-memory fallback so local dev works with no Redis. */
const mem = {
  clients: new Map<string, ClientRecord>(),
  used: new Map<string, number>(),
  log: new Map<string, UsageEntry[]>(),
  users: new Map<string, string>(),
  fails: new Map<string, { count: number; until: number }>(),
};

/* ---------------- logins ---------------- */

/** Failed sign-ins allowed per username before a cool-down. */
const MAX_FAILS = 8;
const LOCK_SECONDS = 15 * 60;
const PBKDF2_ITERATIONS = 120_000;

export const MIN_PASSCODE = 6;

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

/** 3–32 chars: letters, digits, dot, dash, underscore; starts with a letter or digit. */
export function validUsername(u: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(u);
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function hashPasscode(passcode: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(passcode), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function rawClient(id: string): Promise<ClientRecord | null> {
  const r = getRedis();
  return r ? await r.get<ClientRecord>(kClient(id)) : (mem.clients.get(id) ?? null);
}

async function putClient(rec: ClientRecord): Promise<void> {
  const r = getRedis();
  if (r) await r.set(kClient(rec.id), rec);
  else mem.clients.set(rec.id, rec);
}

export async function clientIdForUsername(username: string): Promise<string | null> {
  const u = normalizeUsername(username);
  const r = getRedis();
  const id = r ? await r.get<string>(kUser(u)) : (mem.users.get(u) ?? null);
  return id ?? null;
}

async function failCount(u: string): Promise<number> {
  const r = getRedis();
  if (r) return Number(await r.get<number>(kFail(u))) || 0;
  const f = mem.fails.get(u);
  if (!f || f.until < Date.now()) return 0;
  return f.count;
}

async function recordFail(u: string): Promise<void> {
  const r = getRedis();
  if (r) {
    const n = (await r.incr(kFail(u))) as number;
    if (n === 1) await r.expire(kFail(u), LOCK_SECONDS);
    return;
  }
  const f = mem.fails.get(u);
  if (!f || f.until < Date.now()) mem.fails.set(u, { count: 1, until: Date.now() + LOCK_SECONDS * 1000 });
  else f.count += 1;
}

async function clearFails(u: string): Promise<void> {
  const r = getRedis();
  if (r) await r.del(kFail(u));
  else mem.fails.delete(u);
}

export type LoginResult = { ok: true; client: ClientWithUsage } | { ok: false; reason: "invalid" | "locked" };

/**
 * Check a username + passcode. Counts failures per username and locks that
 * username for 15 minutes after repeated misses, so a short passcode can't be
 * walked through by trying every combination.
 */
export async function verifyLogin(username: string, passcode: string): Promise<LoginResult> {
  const u = normalizeUsername(username);
  if (!u || !passcode) return { ok: false, reason: "invalid" };
  if ((await failCount(u)) >= MAX_FAILS) return { ok: false, reason: "locked" };

  const id = await clientIdForUsername(u);
  const rec = id ? await rawClient(id) : null;
  let good = false;
  if (rec?.passHash && rec.passSalt) {
    good = sameHex(await hashPasscode(passcode.trim(), rec.passSalt), rec.passHash);
  } else {
    // Spend the same time on unknown usernames so timing doesn't reveal which exist.
    await hashPasscode(passcode, "00".repeat(16));
  }
  if (!good || !rec) {
    await recordFail(u);
    return { ok: false, reason: "invalid" };
  }
  await clearFails(u);
  return { ok: true, client: await attachUsage(rec) };
}

/** Set (or replace) a client's username and passcode. The old ones stop working at once. */
export async function setLogin(id: string, username: string, passcode: string): Promise<ClientWithUsage> {
  const u = normalizeUsername(username);
  if (!validUsername(u)) throw new Error("Username must be 3–32 characters: letters, numbers, dot, dash or underscore.");
  if (passcode.trim().length < MIN_PASSCODE) throw new Error(`Passcode must be at least ${MIN_PASSCODE} characters.`);
  const rec = await rawClient(id);
  if (!rec) throw new Error("Client not found.");
  const owner = await clientIdForUsername(u);
  if (owner && owner !== id) throw new Error(`The username "${u}" is already taken.`);

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const next: ClientRecord = { ...rec, username: u, passSalt: salt, passHash: await hashPasscode(passcode.trim(), salt) };
  const r = getRedis();
  if (rec.username && rec.username !== u) {
    if (r) await r.del(kUser(rec.username));
    else mem.users.delete(rec.username);
  }
  if (r) await r.set(kUser(u), id);
  else mem.users.set(u, id);
  await putClient(next);
  await clearFails(u);
  return attachUsage(next);
}

/* ---------------- clients ---------------- */

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || `client-${Date.now().toString(36)}`
  );
}

export async function listClients(): Promise<ClientWithUsage[]> {
  const r = getRedis();
  let records: ClientRecord[];
  if (r) {
    const ids = (await r.smembers(K_CLIENTS)) as string[];
    if (!ids.length) return [];
    const raw = await Promise.all(ids.map((id) => r.get<ClientRecord>(kClient(id))));
    records = raw.filter((x): x is ClientRecord => Boolean(x));
  } else {
    records = [...mem.clients.values()];
  }
  const withUsage = await Promise.all(records.map((c) => attachUsage(c)));
  return withUsage.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getClient(id: string): Promise<ClientWithUsage | null> {
  const r = getRedis();
  const rec = r ? await r.get<ClientRecord>(kClient(id)) : (mem.clients.get(id) ?? null);
  if (!rec) return null;
  return attachUsage(rec);
}

async function attachUsage(rec: ClientRecord): Promise<ClientWithUsage> {
  const r = getRedis();
  const usedRaw = r ? await r.get<number>(kUsed(rec.id)) : mem.used.get(rec.id);
  const creditsUsed = Math.max(0, Number(usedRaw) || 0);
  const creditsLeft = Math.max(0, rec.creditsTotal - creditsUsed);
  const percentLeft = rec.creditsTotal > 0 ? Math.round((creditsLeft / rec.creditsTotal) * 100) : 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passHash, passSalt, ...safe } = rec;
  return { ...safe, hasLogin: Boolean(passHash && rec.username), creditsUsed, creditsLeft, percentLeft };
}

export async function createClient(input: {
  name: string;
  username: string;
  passcode: string;
  plan: PlanId;
  credits?: number;
  note?: string;
}): Promise<ClientWithUsage> {
  const id = slugify(input.name);
  const existing = await getClient(id);
  if (existing) throw new Error(`A client called "${input.name}" already exists.`);
  const u = normalizeUsername(input.username);
  if (!validUsername(u)) throw new Error("Username must be 3–32 characters: letters, numbers, dot, dash or underscore.");
  if (input.passcode.trim().length < MIN_PASSCODE) throw new Error(`Passcode must be at least ${MIN_PASSCODE} characters.`);
  if (await clientIdForUsername(u)) throw new Error(`The username "${u}" is already taken.`);

  const rec: ClientRecord = {
    id,
    name: input.name.trim(),
    plan: input.plan,
    creditsTotal: input.credits ?? PLANS[input.plan].credits,
    active: true,
    note: input.note?.trim() || undefined,
    createdAt: Date.now(),
  };
  const r = getRedis();
  if (r) {
    await Promise.all([r.set(kClient(id), rec), r.set(kUsed(id), 0), r.sadd(K_CLIENTS, id)]);
  } else {
    mem.clients.set(id, rec);
    mem.used.set(id, 0);
  }
  return setLogin(id, u, input.passcode);
}

export async function updateClient(
  id: string,
  patch: Partial<Pick<ClientRecord, "name" | "plan" | "creditsTotal" | "active" | "note" | "lastActiveAt">>,
): Promise<ClientWithUsage | null> {
  const rec = await rawClient(id);
  if (!rec) return null;
  const next: ClientRecord = { ...rec, ...patch };
  await putClient(next);
  return attachUsage(next);
}

/** Add credits to the client's pool (a top-up). */
export async function topUp(id: string, credits: number): Promise<ClientWithUsage | null> {
  const c = await getClient(id);
  if (!c) return null;
  return updateClient(id, { creditsTotal: c.creditsTotal + Math.max(0, Math.round(credits)) });
}

/** Zero the usage counter — starts the client's meter at 100% again. */
export async function resetUsage(id: string): Promise<ClientWithUsage | null> {
  const r = getRedis();
  if (r) await r.set(kUsed(id), 0);
  else mem.used.set(id, 0);
  return getClient(id);
}

export async function deleteClient(id: string): Promise<void> {
  const rec = await rawClient(id);
  const r = getRedis();
  if (r) {
    await Promise.all([
      r.del(kClient(id)),
      r.del(kUsed(id)),
      r.del(kLog(id)),
      r.srem(K_CLIENTS, id),
      ...(rec?.username ? [r.del(kUser(rec.username))] : []),
    ]);
  } else {
    mem.clients.delete(id);
    mem.used.delete(id);
    mem.log.delete(id);
    if (rec?.username) mem.users.delete(rec.username);
  }
}

/* ---------------- credits ---------------- */

export type SpendResult =
  | { ok: true; client: ClientWithUsage }
  | { ok: false; reason: "not_found" | "inactive" | "insufficient"; creditsLeft?: number; needed?: number };

/**
 * Atomically reserve credits before doing paid work.
 * Increments the used counter first, then rolls back if it would exceed the pool,
 * so two generations running at once can never overspend the balance.
 */
export async function spendCredits(id: string, credits: number, entry: Omit<UsageEntry, "at" | "credits">): Promise<SpendResult> {
  const amount = Math.max(0, Math.round(credits));
  const client = await getClient(id);
  if (!client) return { ok: false, reason: "not_found" };
  if (!client.active) return { ok: false, reason: "inactive" };

  const r = getRedis();
  let usedAfter: number;
  if (r) {
    usedAfter = (await r.incrby(kUsed(id), amount)) as number;
  } else {
    usedAfter = (mem.used.get(id) ?? 0) + amount;
    mem.used.set(id, usedAfter);
  }

  if (usedAfter > client.creditsTotal) {
    // Roll back — this request does not fit in the remaining pool.
    if (r) await r.incrby(kUsed(id), -amount);
    else mem.used.set(id, (mem.used.get(id) ?? amount) - amount);
    return {
      ok: false,
      reason: "insufficient",
      creditsLeft: Math.max(0, client.creditsTotal - (usedAfter - amount)),
      needed: amount,
    };
  }

  await appendLog(id, { at: Date.now(), credits: amount, ...entry });
  await updateClient(id, { lastActiveAt: Date.now() });
  const fresh = await getClient(id);
  return { ok: true, client: fresh! };
}

/** Give credits back when the paid work failed. */
export async function refundCredits(id: string, credits: number): Promise<void> {
  const amount = Math.max(0, Math.round(credits));
  if (!amount) return;
  const r = getRedis();
  if (r) await r.incrby(kUsed(id), -amount);
  else mem.used.set(id, Math.max(0, (mem.used.get(id) ?? 0) - amount));
  await appendLog(id, { at: Date.now(), action: "Refund (generation failed)", credits: -amount });
}

/* ---------------- usage log ---------------- */

async function appendLog(id: string, entry: UsageEntry): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.lpush(kLog(id), JSON.stringify(entry));
    await r.ltrim(kLog(id), 0, 499);
  } else {
    const list = mem.log.get(id) ?? [];
    list.unshift(entry);
    mem.log.set(id, list.slice(0, 500));
  }
}

export async function getLog(id: string, limit = 100): Promise<UsageEntry[]> {
  const r = getRedis();
  if (r) {
    const raw = (await r.lrange(kLog(id), 0, limit - 1)) as unknown[];
    return raw
      .map((x) => (typeof x === "string" ? safeParse(x) : (x as UsageEntry)))
      .filter((x): x is UsageEntry => Boolean(x));
  }
  return (mem.log.get(id) ?? []).slice(0, limit);
}

function safeParse(s: string): UsageEntry | null {
  try {
    return JSON.parse(s) as UsageEntry;
  } catch {
    return null;
  }
}

/* ---------------- first-run seed ---------------- */

/**
 * If SEED_CLIENT_USERNAME and SEED_CLIENT_PASSCODE are set and no clients exist
 * yet, create one so a fresh deploy is usable before you open the admin panel.
 */
export async function ensureSeedClient(): Promise<void> {
  const pass = process.env.SEED_CLIENT_PASSCODE;
  const username = process.env.SEED_CLIENT_USERNAME;
  if (!pass || !username) return;
  const existing = await listClients();
  if (existing.length) return;
  try {
    await createClient({
      name: process.env.SEED_CLIENT_NAME || "First client",
      username,
      passcode: pass,
      plan: "max",
    });
  } catch {
    /* already seeded elsewhere */
  }
}
