import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** Centered sign-in frame shared by the client and owner sign-in screens. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />
      <div className="rise relative w-full max-w-[380px]">
        <div className="mb-6 flex justify-center">
          <Logo markClassName="h-9 w-9" />
        </div>
        <div className="card p-7 shadow-[0_8px_30px_rgba(11,11,15,0.06)]">
          <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[11px] text-[var(--muted)]">{footer}</div>}
      </div>
    </main>
  );
}

export function PasscodeInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      autoFocus={autoFocus}
      type="password"
      autoComplete={autoComplete}
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
