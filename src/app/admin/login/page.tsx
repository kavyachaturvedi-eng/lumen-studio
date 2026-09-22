"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

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
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={submit} className="card rise w-full max-w-sm p-8">
        <div className="mb-7 flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Studio admin</h1>
            <p className="text-xs text-stone-500">Clients, plans and credits</p>
          </div>
        </div>
        <label className="label mb-2 block">Admin passcode</label>
        <input autoFocus type="password" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Owner passcode" />
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        <button className="btn-primary mt-4 w-full" disabled={busy || !code}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
