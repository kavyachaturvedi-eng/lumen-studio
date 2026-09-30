"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, PasscodeInput } from "@/components/AuthShell";

export default function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.ok) router.replace("/admin");
    else setErr(data.error || "Wrong admin passcode.");
  }

  return (
    <AuthShell title="Studio admin" subtitle="Clients, plans and credits.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="label mb-2 block">Owner passcode</span>
          <PasscodeInput autoFocus value={code} onChange={setCode} placeholder="ADMIN_PASSCODE" />
        </label>
        {err && <p className="text-[12px] text-[var(--bad)]">{err}</p>}
        <button className="btn-primary w-full py-3" disabled={busy || !code}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
