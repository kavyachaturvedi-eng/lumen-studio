"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.ok) router.replace(params.get("next") || "/");
    else setErr(data.error || "That passcode isn't recognised.");
  }

  return (
    <form onSubmit={submit} className="card rise w-full max-w-sm p-8 shadow-sm">
      <div className="mb-7 flex items-center gap-3">
        <Logo />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Lumen Studio</h1>
          <p className="text-xs text-stone-500">AI product photography</p>
        </div>
      </div>
      <label className="label mb-2 block">Your passcode</label>
      <input
        autoFocus
        type="password"
        className="input"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter the passcode you were given"
      />
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button className="btn-primary mt-4 w-full" disabled={busy || !code}>
        {busy ? "Checking…" : "Enter studio"}
      </button>
      <p className="mt-5 text-center text-[11px] text-stone-400">Private studio. Ask the owner for access.</p>
    </form>
  );
}

export default function UnlockPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense>
        <UnlockForm />
      </Suspense>
    </main>
  );
}
