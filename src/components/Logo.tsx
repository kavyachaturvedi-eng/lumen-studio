/**
 * Lumen Studio brand mark: a camera whose lens is a six-blade aperture with a
 * cobalt light core — the "lumen" — at its centre.
 */

const BLADES =
  "M33.99 33.06L38.92 41.61M30.01 33.06L39.89 33.06M28.03 36.5L32.96 27.95M30.01 39.94L25.08 31.39M33.99 39.94L24.11 39.94M35.97 36.5L31.04 45.05";
const CORE = "M33.99 33.06L35.97 36.5L33.99 39.94L30.01 39.94L28.03 36.5L30.01 33.06Z";

export function LogoMark({ className = "h-8 w-8", title = "Lumen Studio" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <rect width="64" height="64" rx="16" fill="#0B0B0F" />
      <rect x="10" y="21" width="44" height="31" rx="9.5" fill="#fff" />
      <rect x="16.5" y="16" width="12" height="8" rx="3" fill="#fff" />
      <circle cx="32" cy="36.5" r="11.2" fill="#0B0B0F" />
      <path d={CORE} fill="#3D63FF" />
      <path d={BLADES} stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="46.2" cy="27.2" r="1.9" fill="#0B0B0F" />
    </svg>
  );
}

export function Logo({
  className = "",
  markClassName = "h-8 w-8",
  wordmark = true,
  sub,
}: {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  sub?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      {wordmark && (
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            Lumen<span className="font-normal text-[var(--muted)]"> Studio</span>
          </div>
          {sub && <div className="mt-1 text-[11px] text-[var(--muted)]">{sub}</div>}
        </div>
      )}
    </div>
  );
}
