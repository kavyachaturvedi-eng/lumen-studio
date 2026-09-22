"use client";

import { useCallback, useEffect, useState } from "react";
import { Logo } from "./Logo";
import { PLANS, PLAN_ORDER, PRICE_LIST, type PlanId } from "@/lib/plans";

interface ClientRow {
  id: string;
  name: string;
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

export function Admin() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [persistent, setPersistent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [adding, setAdding] = useState(false);

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

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-9" />
            <div>
              <div className="text-[15px] font-semibold tracking-tight">Studio admin</div>
              <div className="text-[11px] text-stone-500">{clients.length} client{clients.length === 1 ? "" : "s"}</div>
            </div>
          </div>
          <button className="btn-ghost" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Add client"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-6">
        {!persistent && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>No database connected.</strong> Clients and credits are being kept in memory only and will vanish when the server
            restarts. Add <code className="font-mono">KV_REST_API_URL</code> and <code className="font-mono">KV_REST_API_TOKEN</code> in
            Vercel to make them permanent.
          </div>
        )}
        {err && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800">{err}</div>}

        {adding && <AddClient onDone={() => { setAdding(false); load(); }} onError={setErr} />}

        {loading && <div className="shimmer h-24 w-full rounded-2xl" />}

        {!loading && !clients.length && !adding && (
          <div className="card p-10 text-center">
            <h2 className="text-base font-semibold">No clients yet</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-stone-500">
              Add your first client, give them the passcode, and they land straight in the studio with their plan and credit pool.
            </p>
            <button className="btn-primary mt-4" onClick={() => setAdding(true)}>
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
          />
        ))}

        <div className="card p-4">
          <div className="label mb-2.5">What a shot costs</div>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {PRICE_LIST.map((p) => (
              <div key={p.label} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-stone-600">{p.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">{p.credits}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-snug text-stone-500">
            Credits are calibrated so one credit costs you no more than a Nano Banana 2 image at 1K. Heavier work is priced above its
            true cost, so your margin never inverts. Clients only ever see credits and a percentage.
          </p>
        </div>
      </main>
    </div>
  );
}

function ClientCard({
  client: c,
  open,
  log,
  onToggleLog,
  onPatch,
}: {
  client: ClientRow;
  open: boolean;
  log: LogEntry[];
  onToggleLog: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [topup, setTopup] = useState("");
  const [newPass, setNewPass] = useState("");
  const tone = c.percentLeft > 40 ? "#3f6f4f" : c.percentLeft > 15 ? "#a06a1b" : "#a3372c";

  return (
    <div className={`card p-4 ${c.active ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{c.name}</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
              {PLANS[c.plan].label}
            </span>
            {!c.active && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Paused</span>}
          </div>
          <div className="mt-0.5 text-[11px] text-stone-500">
            {c.lastActiveAt ? `Last used ${new Date(c.lastActiveAt).toLocaleDateString()}` : "Not used yet"}
            {c.note ? ` · ${c.note}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums" style={{ color: tone }}>
            {c.percentLeft}%
          </div>
          <div className="text-[11px] tabular-nums text-stone-500">
            {c.creditsLeft.toLocaleString()} / {c.creditsTotal.toLocaleString()} cr
          </div>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200/70">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${c.percentLeft}%`, background: tone }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="input w-auto py-1.5 text-xs"
          value={c.plan}
          onChange={(e) => onPatch({ id: c.id, action: "update", plan: e.target.value })}
        >
          {PLAN_ORDER.map((p) => (
            <option key={p} value={p}>
              {PLANS[p].label} plan
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            className="input w-24 py-1.5 text-xs"
            placeholder="+ credits"
            inputMode="numeric"
            value={topup}
            onChange={(e) => setTopup(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <button
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={!topup}
            onClick={async () => {
              if (await onPatch({ id: c.id, action: "topup", credits: Number(topup) })) setTopup("");
            }}
          >
            Top up
          </button>
        </div>

        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onPatch({ id: c.id, action: "update", active: !c.active })}>
          {c.active ? "Pause" : "Resume"}
        </button>

        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onPatch({ id: c.id, action: "reset" })}>
          Reset meter
        </button>

        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onToggleLog}>
          {open ? "Hide usage" : "Usage"}
        </button>

        <button
          className="ml-auto text-xs text-red-600 underline underline-offset-2"
          onClick={() => {
            if (confirm(`Delete ${c.name}? Their passcode stops working and usage history is lost.`)) {
              void onPatch({ id: c.id, action: "delete" });
            }
          }}
        >
          Delete
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <input
          className="input w-44 py-1.5 text-xs"
          placeholder="Set a new passcode"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
        />
        <button
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={newPass.trim().length < 4}
          onClick={async () => {
            if (await onPatch({ id: c.id, action: "passcode", passcode: newPass })) setNewPass("");
          }}
        >
          Add passcode
        </button>
        <span className="text-[10px] text-stone-400">Old passcodes keep working until you delete the client.</span>
      </div>

      {open && (
        <div className="mt-4 border-t pt-3 hairline">
          {!log.length && <p className="text-xs text-stone-500">Nothing used yet.</p>}
          {log.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              {log.map((e, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 border-b py-1.5 text-xs last:border-0 hairline">
                  <span className="min-w-0 truncate text-stone-700">{e.action}</span>
                  <span className="shrink-0 text-[10px] text-stone-400">{new Date(e.at).toLocaleString()}</span>
                  <span className={`shrink-0 font-semibold tabular-nums ${e.credits < 0 ? "text-emerald-700" : "text-stone-700"}`}>
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

function AddClient({ onDone, onError }: { onDone: () => void; onError: (e: string) => void }) {
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
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
      body: JSON.stringify({ name, passcode, plan, credits: Number(credits) || PLANS[plan].credits, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      onError(data.error || "Could not create client.");
      return;
    }
    onDone();
  }

  return (
    <div className="card rise p-4">
      <div className="label mb-3">New client</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-stone-700">Client name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bombaby" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-stone-700">Their passcode</span>
          <input className="input" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="at least 4 characters" />
        </label>
      </div>

      <div className="mt-3">
        <span className="mb-1.5 block text-[11px] font-semibold text-stone-700">Plan</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLAN_ORDER.map((p) => (
            <button
              key={p}
              onClick={() => choosePlan(p)}
              className={`rounded-xl border p-2.5 text-left transition-colors ${plan === p ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white hover:border-stone-400"}`}
            >
              <div className="text-[13px] font-semibold">{PLANS[p].label}</div>
              <div className={`mt-0.5 text-[11px] leading-snug ${plan === p ? "text-stone-300" : "text-stone-500"}`}>{PLANS[p].blurb}</div>
              <div className={`mt-1 text-[11px] font-medium ${plan === p ? "text-stone-200" : "text-stone-600"}`}>
                {PLANS[p].credits.toLocaleString()} credits
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-stone-700">Credits to grant</span>
          <input className="input" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/[^0-9]/g, ""))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-stone-700">Note (only you see this)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid ₹10,000 on 21 Sep" />
        </label>
      </div>

      <button className="btn-primary mt-4" disabled={busy || !name.trim() || passcode.trim().length < 4} onClick={submit}>
        {busy ? "Creating…" : "Create client"}
      </button>
    </div>
  );
}
