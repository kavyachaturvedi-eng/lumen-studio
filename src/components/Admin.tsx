"use client";

import { useCallback, useEffect, useState } from "react";
import { Logo } from "./Logo";
import { PLANS, PLAN_ORDER, PRICE_LIST, type PlanId } from "@/lib/plans";

interface ClientRow {
  id: string;
  name: string;
  username?: string;
  hasLogin: boolean;
  plan: PlanId;
  creditsTotal: number;
  creditsUsed: number;
  creditsLeft: number;
  percentLeft: number;
  active: boolean;
  note?: string;
  createdAt: number;
  lastActiveAt?: number;
}

interface LogEntry {
  at: number;
  action: string;
  credits: number;
  model?: string;
}

interface Credentials {
  name: string;
  username: string;
  passcode: string;
}

const MIN_PASSCODE = 6;

/** 10 characters from an alphabet with no look-alikes (no 0/O, 1/l/I). */
function generatePasscode(len = 10): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function usernameFrom(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function tone(pct: number) {
  return pct > 40 ? "var(--accent)" : pct > 15 ? "var(--warn)" : "var(--bad)";
}

export function Admin() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [persistent, setPersistent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<Credentials | null>(null);

  const [reloadAt, setReloadAt] = useState(0);
  const load = useCallback(() => setReloadAt(Date.now()), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/clients")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load clients.");
        return data as { clients?: ClientRow[]; persistent?: boolean };
      })
      .then((data) => {
        if (cancelled) return;
        setClients(data.clients ?? []);
        setPersistent(Boolean(data.persistent));
        setErr(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadAt]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "Update failed.");
      return false;
    }
    setErr(null);
    load();
    return true;
  }

  async function openLog(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setLog([]);
    const res = await fetch(`/api/admin/clients?id=${encodeURIComponent(id)}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setLog(data.log ?? []);
  }

  const active = clients.filter((c) => c.active).length;
  const issuedCredits = clients.reduce((s, c) => s + c.creditsTotal, 0);
  const usedCredits = clients.reduce((s, c) => s + c.creditsUsed, 0);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-white/85 backdrop-blur-md hairline">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="badge">Admin</span>
          </div>
          <button
            className="btn-primary btn-sm"
            onClick={() => {
              setAdding((v) => !v);
              setIssued(null);
            }}
          >
            {adding ? "Cancel" : "+ Add client"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-6">
        {!persistent && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900">
            <strong>No database connected.</strong> Clients and credits are being kept in memory only and will vanish when the server restarts. Add{" "}
            <code className="font-mono">KV_REST_API_URL</code> and <code className="font-mono">KV_REST_API_TOKEN</code> in Vercel to make them permanent.
          </div>
        )}
        {err && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
            <span>{err}</span>
            <button className="shrink-0 text-red-600" onClick={() => setErr(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Clients", clients.length.toLocaleString()],
            ["Active", active.toLocaleString()],
            ["Credits issued", issuedCredits.toLocaleString()],
            ["Credits used", usedCredits.toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="card px-4 py-3">
              <div className="label">{k}</div>
              <div className="mt-1 font-mono text-[20px] font-medium tabular-nums tracking-tight">{v}</div>
            </div>
          ))}
        </div>

        {issued && <IssuedCredentials creds={issued} onClose={() => setIssued(null)} />}

        {adding && (
          <AddClient
            onDone={(creds) => {
              setAdding(false);
              setIssued(creds);
              load();
            }}
            onError={setErr}
          />
        )}

        {loading && <div className="shimmer h-28 w-full rounded-2xl" />}

        {!loading && !clients.length && !adding && (
          <div className="card p-10 text-center">
            <h2 className="text-[16px] font-semibold tracking-tight">No clients yet</h2>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[var(--muted)]">
              Add a client, send them their username and passcode, and they land straight in the studio with their plan and credit pool.
            </p>
            <button className="btn-primary mt-5" onClick={() => setAdding(true)}>
              Add your first client
            </button>
          </div>
        )}

        {clients.map((c) => (
          <ClientCard
            key={c.id}
            client={c}
            open={openId === c.id}
            log={openId === c.id ? log : []}
            onToggleLog={() => openLog(c.id)}
            onPatch={patch}
            onIssued={setIssued}
          />
        ))}

        <div className="card p-5">
          <div className="label mb-3">What a shot costs</div>
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {PRICE_LIST.map((p) => (
              <div key={p.label} className="flex items-baseline justify-between gap-3 border-b pb-2 text-[12px] hairline">
                <span className="text-[var(--ink-2)]">{p.label}</span>
                <span className="shrink-0 font-mono font-medium tabular-nums">{p.credits}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-snug text-[var(--muted)]">
            One credit costs you no more than one Nano Banana 2 image at 1K. Heavier work is priced above its true cost, so your margin never inverts.
            Clients only ever see credits and a percentage — never a currency amount.
          </p>
        </div>
      </main>
    </div>
  );
}

function IssuedCredentials({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin : "";
  const message = `Hi ${creds.name}, your Lumen Studio login is ready.\n\nOpen: ${url}\nUsername: ${creds.username}\nPasscode: ${creds.passcode}\n\nPlease keep the passcode private.`;
  return (
    <div className="card rise overflow-hidden border-[var(--accent)]">
      <div className="flex items-start justify-between gap-3 bg-[var(--accent-soft)] px-5 py-3">
        <div>
          <div className="text-[13px] font-semibold">Login ready for {creds.name}</div>
          <div className="text-[11px] text-[var(--muted)]">Copy it now — the passcode is stored hashed and can&rsquo;t be shown again.</div>
        </div>
        <button className="text-[18px] leading-none text-[var(--muted)] hover:text-[var(--ink)]" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        {[
          ["Studio link", url],
          ["Username", creds.username],
          ["Passcode", creds.passcode],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="label mb-1">{k}</div>
            <div className="truncate font-mono text-[13px]">{v}</div>
          </div>
        ))}
      </div>
      <div className="border-t px-5 py-3 hairline">
        <button
          className="btn-accent btn-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? "Copied" : "Copy message for the client"}
        </button>
      </div>
    </div>
  );
}

function ClientCard({
  client: c,
  open,
  log,
  onToggleLog,
  onPatch,
  onIssued,
}: {
  client: ClientRow;
  open: boolean;
  log: LogEntry[];
  onToggleLog: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<boolean>;
  onIssued: (c: Credentials) => void;
}) {
  const [topup, setTopup] = useState("");
  const [loginOpen, setLoginOpen] = useState(!c.hasLogin);
  const [username, setUsername] = useState(c.username ?? usernameFrom(c.name));
  const [newPass, setNewPass] = useState("");

  return (
    <div className={`card p-5 ${c.active ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight">{c.name}</span>
            <span className="badge">{PLANS[c.plan].label}</span>
            {!c.active && <span className="badge !bg-red-50 !text-red-700">Paused</span>}
            {!c.hasLogin && <span className="badge !bg-amber-50 !text-amber-800">No login set</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--muted)]">
            {c.username && <span className="font-mono text-[var(--ink-2)]">@{c.username}</span>}
            <span>{c.lastActiveAt ? `Last used ${new Date(c.lastActiveAt).toLocaleDateString()}` : "Not used yet"}</span>
            {c.note && <span>· {c.note}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[18px] font-medium tabular-nums" style={{ color: tone(c.percentLeft) }}>
            {c.percentLeft}%
          </div>
          <div className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
            {c.creditsLeft.toLocaleString()} / {c.creditsTotal.toLocaleString()} cr
          </div>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${c.percentLeft}%`, background: tone(c.percentLeft) }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1.5 text-[12px]" value={c.plan} onChange={(e) => onPatch({ id: c.id, action: "update", plan: e.target.value })}>
          {PLAN_ORDER.map((p) => (
            <option key={p} value={p}>
              {PLANS[p].label} plan
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            className="input w-24 py-1.5 text-[12px]"
            placeholder="+ credits"
            inputMode="numeric"
            value={topup}
            onChange={(e) => setTopup(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <button
            className="btn-ghost btn-sm"
            disabled={!topup}
            onClick={async () => {
              if (await onPatch({ id: c.id, action: "topup", credits: Number(topup) })) setTopup("");
            }}
          >
            Top up
          </button>
        </div>

        <button className="btn-ghost btn-sm" onClick={() => onPatch({ id: c.id, action: "update", active: !c.active })}>
          {c.active ? "Pause" : "Resume"}
        </button>
        <button className="btn-ghost btn-sm" onClick={() => onPatch({ id: c.id, action: "reset" })}>
          Reset meter
        </button>
        <button className="btn-ghost btn-sm" onClick={onToggleLog}>
          {open ? "Hide usage" : "Usage"}
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setLoginOpen((v) => !v)}>
          {c.hasLogin ? "Reset login" : "Set login"}
        </button>

        <button
          className="ml-auto text-[12px] text-[var(--bad)] underline underline-offset-2"
          onClick={() => {
            if (confirm(`Delete ${c.name}? Their login stops working and usage history is lost.`)) void onPatch({ id: c.id, action: "delete" });
          }}
        >
          Delete
        </button>
      </div>

      {loginOpen && (
        <div className="mt-3 rounded-xl border bg-[var(--surface-2)] p-3 hairline">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="label mb-1 block">Username</span>
              <input className="input py-2 font-mono text-[12px]" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))} />
            </label>
            <label className="block">
              <span className="label mb-1 block">New passcode</span>
              <div className="flex gap-1">
                <input className="input py-2 font-mono text-[12px]" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={`${MIN_PASSCODE}+ characters`} />
                <button className="btn-ghost btn-sm" type="button" onClick={() => setNewPass(generatePasscode())}>
                  Generate
                </button>
              </div>
            </label>
            <div className="flex items-end">
              <button
                className="btn-primary btn-sm w-full py-2"
                disabled={username.trim().length < 3 || newPass.trim().length < MIN_PASSCODE}
                onClick={async () => {
                  if (await onPatch({ id: c.id, action: "login", username, passcode: newPass })) {
                    onIssued({ name: c.name, username: username.trim().toLowerCase(), passcode: newPass.trim() });
                    setNewPass("");
                    setLoginOpen(false);
                  }
                }}
              >
                Save login
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted)]">Saving replaces the old login immediately — the previous passcode stops working.</p>
        </div>
      )}

      {open && (
        <div className="mt-4 border-t pt-3 hairline">
          {!log.length && <p className="text-[12px] text-[var(--muted)]">Nothing used yet.</p>}
          {log.length > 0 && (
            <div className="scroll-quiet max-h-64 overflow-y-auto">
              {log.map((e, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 border-b py-1.5 text-[12px] last:border-0 hairline">
                  <span className="min-w-0 truncate text-[var(--ink-2)]">{e.action}</span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--subtle)]">{new Date(e.at).toLocaleString()}</span>
                  <span className={`shrink-0 font-mono font-medium tabular-nums ${e.credits < 0 ? "text-[var(--ok)]" : "text-[var(--ink)]"}`}>
                    {e.credits < 0 ? "+" : "−"}
                    {Math.abs(e.credits)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddClient({ onDone, onError }: { onDone: (c: Credentials) => void; onError: (e: string) => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [userTouched, setUserTouched] = useState(false);
  const [passcode, setPasscode] = useState(() => generatePasscode());
  const [plan, setPlan] = useState<PlanId>("basic");
  const [credits, setCredits] = useState(String(PLANS.basic.credits));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function choosePlan(p: PlanId) {
    setPlan(p);
    setCredits(String(PLANS[p].credits));
  }

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, passcode, plan, credits: Number(credits) || PLANS[plan].credits, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      onError(data.error || "Could not create client.");
      return;
    }
    onDone({ name: name.trim(), username: username.trim().toLowerCase(), passcode: passcode.trim() });
  }

  const ready = name.trim() && username.trim().length >= 3 && passcode.trim().length >= MIN_PASSCODE;

  return (
    <div className="card rise p-5">
      <div className="mb-4 text-[15px] font-semibold tracking-tight">New client</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label mb-1.5 block">Client name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!userTouched) setUsername(usernameFrom(e.target.value));
            }}
            placeholder="e.g. Bombaby"
          />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">Username</span>
          <input
            className="input font-mono"
            value={username}
            onChange={(e) => {
              setUserTouched(true);
              setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""));
            }}
            placeholder="bombaby"
          />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">Passcode</span>
          <div className="flex gap-1">
            <input className="input font-mono" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder={`${MIN_PASSCODE}+ characters`} />
            <button className="btn-ghost btn-sm" type="button" onClick={() => setPasscode(generatePasscode())} title="Generate a strong passcode">
              ↻
            </button>
          </div>
        </label>
      </div>

      <div className="mt-4">
        <span className="label mb-2 block">Plan</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLAN_ORDER.map((p) => (
            <button
              key={p}
              onClick={() => choosePlan(p)}
              className={`rounded-xl border p-3 text-left transition-colors ${plan === p ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white hover:border-[var(--line-strong)]"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">{PLANS[p].label}</span>
                <span className={`font-mono text-[11px] ${plan === p ? "text-white/70" : "text-[var(--muted)]"}`}>{PLANS[p].credits.toLocaleString()} cr</span>
              </div>
              <div className={`mt-1 text-[11px] leading-snug ${plan === p ? "text-white/65" : "text-[var(--muted)]"}`}>{PLANS[p].blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label mb-1.5 block">Credits to grant</span>
          <input className="input font-mono" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/[^0-9]/g, ""))} />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">Note · only you see this</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid ₹10,000 on 21 Sep" />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary" disabled={busy || !ready} onClick={submit}>
          {busy ? "Creating…" : "Create client"}
        </button>
        <span className="text-[11px] text-[var(--muted)]">You&rsquo;ll get a ready-to-send message with their login.</span>
      </div>
    </div>
  );
}
