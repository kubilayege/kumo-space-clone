import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[var(--paper)] px-6 text-center">
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-50" />
      <div className="relative z-10">
        <p className="font-mono text-[120px] font-bold leading-none tracking-tight text-[var(--ink-ghost)]">404</p>
        <h1 className="-mt-8 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Space not found
        </h1>
        <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
          This corner of the world does not exist yet.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white shadow-[var(--shadow-md)] transition hover:bg-[var(--accent-hover)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back home
        </Link>
      </div>
    </div>
  );
}
