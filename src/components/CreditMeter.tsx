"use client";

/**
 * The client-facing credit meter.
 *
 * Deliberately shows a percentage and a credit count only — never a currency
 * amount, never what the pool cost to fund. That is the studio owner's business.
 */
export function CreditMeter({ percentLeft, creditsLeft, compact }: { percentLeft: number; creditsLeft: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, percentLeft));
  const tone = pct > 40 ? "#3f6f4f" : pct > 15 ? "#a06a1b" : "#a3372c";
  const r = 13;
  const c = 2 * Math.PI * r;

  if (compact) {
    return (
      <div className="flex items-center gap-2" title={`${creditsLeft} credits left`}>
        <Ring pct={pct} tone={tone} r={r} c={c} />
        <div className="leading-tight">
          <div className="text-xs font-semibold tabular-nums">{pct}%</div>
          <div className="text-[10px] text-stone-500">credits</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">Credits</div>
        <div className="text-xs font-semibold tabular-nums" style={{ color: tone }}>
          {pct}% left
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200/70">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: tone }} />
      </div>
      <div className="mt-2 text-[11px] text-stone-500">
        <span className="font-medium tabular-nums text-stone-700">{creditsLeft.toLocaleString()}</span> credits remaining in this plan
      </div>
    </div>
  );
}

function Ring({ pct, tone, r, c }: { pct: number; tone: string; r: number; c: number }) {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 -rotate-90">
      <circle cx="16" cy="16" r={r} fill="none" stroke="#e7e4dd" strokeWidth="4" />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}
