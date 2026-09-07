export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div className={`${className} grid place-items-center rounded-xl bg-stone-900 text-white`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
        <circle cx="12" cy="12.5" r="3.2" />
      </svg>
    </div>
  );
}
