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
  plan: PlanId;
  creditsTotal: number;
  active: boolean;
  note?: string;
  createdAt: number;
  lastActiveAt?: number;
}

export interface ClientWithUsage extends ClientRecord {
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
const kPass = (hash: string) => `${P}pass:${hash}`;
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
  pass: new Map<string, string>(),
};

/* ---------------- passcodes ---------------- */

export async function hashPasscode(passcode: string): Promise<string> {
  const data = new TextEncoder().encode("lumen-passcode:" + passcode.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  return { ...rec, creditsUsed, creditsLeft, percentLeft };
}

/** Resolve a passcode to a client id. Returns null if unknown. */
export async function clientIdForPasscode(passcode: string): Promise<string | null> {
  const hash = await hashPasscode(passcode);
  const r = getRedis();
  const id = r ? await r.get<string>(kPass(hash)) : (mem.pass.get(hash) ?? null);
  return id ?? null;
}

export async function createClient(input: {
  name: string;
  passcode: string;
  plan: PlanId;
  credits?: number;
  note?: string;
}): Promise<ClientWithUsage> {
  const id = slugify(input.name);
  const existing = await getClient(id);
  if (existing) throw new Error(`A client called "${input.name}" already exists.`);
  if (await clientIdForPasscode(input.passcode)) throw new Error("That passcode is already in use by another client.");

  const rec: ClientRecord = {
    id,
    name: input.name.trim(),
    plan: input.plan,
    creditsTotal: input.credits ?? PLANS[input.plan].credits,
    active: true,
    note: input.note?.trim() || undefined,
    createdAt: Date.now(),
  };
  const hash = await hashPasscode(input.passcode);
  const r = getRedis();
  if (r) {
    await Promise.all([r.set(kClient(id), rec), r.set(kUsed(id), 0), r.set(kPass(hash), id), r.sadd(K_CLIENTS, id)]);
  } else {
    mem.clients.set(id, rec);
    mem.used.set(id, 0);
    mem.pass.set(hash, id);
  }
  return attachUsage(rec);
}

export async function updateClient(
  id: string,
  patch: Partial<Pick<ClientRecord, "name" | "plan" | "creditsTotal" | "active" | "note" | "lastActiveAt">>,
): Promise<ClientWithUsage | null> {
  const r = getRedis();
  const rec = r ? await r.get<ClientRecord>(kClient(id)) : (mem.clients.get(id) ?? null);
  if (!rec) return null;
  const next: ClientRecord = { ...rec, ...patch };
  if (r) await r.set(kClient(id), next);
  else mem.clients.set(id, next);
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

export async function setPasscode(id: string, passcode: string): Promise<void> {
  const owner = await clientIdForPasscode(passcode);
  if (owner && owner !== id) throw new Error("That passcode is already in use by another client.");
  const hash = await hashPasscode(passcode);
  const r = getRedis();
  if (r) await r.set(kPass(hash), id);
  else mem.pass.set(hash, id);
}

export async function deleteClient(id: string): Promise<void> {
  const r = getRedis();
  if (r) {
    await Promise.all([r.del(kClient(id)), r.del(kUsed(id)), r.del(kLog(id)), r.srem(K_CLIENTS, id)]);
  } else {
    mem.clients.delete(id);
    mem.used.delete(id);
    mem.log.delete(id);
    for (const [h, cid] of mem.pass) if (cid === id) mem.pass.delete(h);
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
 * If SEED_CLIENT_PASSCODE is set and no clients exist yet, create one so a fresh
 * deploy is usable before you open the admin panel.
 */
export async function ensureSeedClient(): Promise<void> {
  const pass = process.env.SEED_CLIENT_PASSCODE;
  if (!pass) return;
  const existing = await listClients();
  if (existing.length) return;
  try {
    await createClient({
      name: process.env.SEED_CLIENT_NAME || "First client",
      passcode: pass,
      plan: "max",
    });
  } catch {
    /* already seeded elsewhere */
  }
}
