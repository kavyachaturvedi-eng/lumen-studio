"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, PasscodeInput } from "@/components/AuthShell";

function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
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
      body: JSON.stringify({ username, passcode: code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.ok) router.replace(params.get("next") || "/");
    else setErr(data.error || "That username and passcode don't match.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="label mb-2 block">Username</span>
        <input
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. bombaby"
        />
      </label>
      <label className="block">
        <span className="label mb-2 block">Passcode</span>
        <PasscodeInput value={code} onChange={setCode} placeholder="The passcode you were given" />
      </label>
      {err && <p className="text-[12px] text-[var(--bad)]">{err}</p>}
      <button className="btn-primary w-full py-3" disabled={busy || !username.trim() || !code}>
        {busy ? "Checking…" : "Enter studio"}
      </button>
    </form>
  );
}

export default function UnlockPage() {
  return (
    <AuthShell title="Sign in to your studio" subtitle="Use the username and passcode the studio sent you." footer="Private studio · ask the owner for access">
      <Suspense>
        <UnlockForm />
      </Suspense>
    </AuthShell>
  );
}
