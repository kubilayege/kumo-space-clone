import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[#07070d] px-6 text-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="blob absolute left-1/3 top-1/3 h-[420px] w-[420px] bg-indigo-600/15 blur-3xl" />
      </div>
      <div className="relative z-10">
        <p className="text-[120px] font-bold leading-none tracking-tight text-white/10">404</p>
        <h1 className="-mt-8 text-2xl font-semibold tracking-tight text-white">
          Space not found
        </h1>
        <p className="mt-2 text-[14px] text-zinc-400">
          This corner of the office does not exist yet.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-[14px] font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back home
        </Link>
      </div>
    </div>
  );
}
