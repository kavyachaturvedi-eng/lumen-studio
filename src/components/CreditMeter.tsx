"use client";

/**
 * The client-facing credit meter.
 *
 * Deliberately shows a percentage and a credit count only — never a currency
 * amount, never what the pool cost to fund. That is the studio owner's business.
 */
export function CreditMeter({ percentLeft, creditsLeft, compact }: { percentLeft: number; creditsLeft: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, percentLeft));
  const tone = pct > 40 ? "var(--accent)" : pct > 15 ? "var(--warn)" : "var(--bad)";
  const r = 12;
  const c = 2 * Math.PI * r;

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 hairline" title={`${creditsLeft} credits left`}>
        <svg viewBox="0 0 30 30" className="h-6 w-6 -rotate-90">
          <circle cx="15" cy="15" r={r} fill="none" stroke="#ececf0" strokeWidth="3.5" />
          <circle
            cx="15"
            cy="15"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="leading-tight">
          <div className="font-mono text-[12px] font-medium tabular-nums">{pct}%</div>
          <div className="text-[10px] text-[var(--muted)]">{creditsLeft.toLocaleString()} credits</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">Credits</div>
        <div className="font-mono text-xs font-medium tabular-nums" style={{ color: tone }}>
          {pct}% left
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: tone }} />
      </div>
      <div className="mt-2 text-[11px] text-[var(--muted)]">
        <span className="font-medium tabular-nums text-[var(--ink)]">{creditsLeft.toLocaleString()}</span> credits remaining in this plan
      </div>
    </div>
  );
}
